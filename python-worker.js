/* Isolated execution keeps long-running Python off the calculator UI thread.
   Existing Pyodide version is pinned; its runtime is an optional CDN download. */
let runtime;
self.onmessage = async ({data}) => {
  let phase = 'load';
  try {
    if (!runtime) {
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');
      runtime = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'});
    }
    phase = 'run';
    self.postMessage({type:'ready'});
    const lines=[];let length=0;
    const capture=value=>{length+=value.length+1;if(length>100000)throw new Error('Output limit reached (100,000 characters).');lines.push(value);};
    runtime.setStdout({batched:capture});runtime.setStderr({batched:capture});
    let result;
    try{
      result=await runtime.runPythonAsync(data.code);
      if(result!==undefined)capture(String(result));
      self.postMessage({type:'done',output:lines.join('\n')||'Finished with no output.'});
    }catch(error){self.postMessage({type:'error',phase,output:lines.join('\n'),message:error.message});}
    finally{if(result&&typeof result.destroy==='function')result.destroy();}
  } catch(error) {
    if(phase==='load')runtime=null;
    self.postMessage({type:'error',phase,message:error.message});
  }
};
