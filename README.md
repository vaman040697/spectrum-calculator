# spectrum-calculator
A free, browser-based scientific and graphing calculator with 2D/3D plots, equation solving, statistics, matrices, symbolic tools, and Python. Currently in beta.
# Spectrum Calc

A free, browser-based scientific and graphing calculator for exploring mathematics—from everyday calculations to graphs, statistics, and programming.

**Status: Beta.** Spectrum Calc performs real calculations, but features are still being tested and improved. It is not yet a complete replacement for every dedicated graphing calculator.

## Features

- Scientific calculations and formatted mathematical expressions
- Interactive function, parametric, polar, and inequality graphs
- Function tables and numerical equation solving
- Statistics and linear, quadratic, and exponential regression
- Normal and binomial probability tools
- 2×2 matrices, 3D vectors, and selected unit conversions
- A small spreadsheet with cell references and basic formulas
- Interactive 3D surface graphing
- Two-point geometry calculations
- Selected symbolic differentiation and integration
- A browser-based Python scratchpad
- Shareable lesson links
- Optional offline access to the core calculator

## Getting Started

Open the published website using the link shown in this repository’s **Settings → Pages**.

Use the main calculator for graphing, tables, and calculations. Open **Advanced Lab** for the additional mathematics and programming tools.

Enter expressions such as:

- `cos(x)`
- `x^2`
- `sqrt(x)`
- `2*sin(x)`

Use the equation solver to explore equations such as `x^2 = 4`.

## Running Locally

Download or clone the repository. From the folder containing `index.html`, run:

```bash
python3 -m http.server 8765
```

Then open **http://localhost:8765/** in your browser.

Using a local server is recommended instead of opening the HTML files directly, especially for Python and offline features.

## Offline Access and Python

Enable offline mode while connected to the internet to cache the core application.

Python runs in your browser using Pyodide and requires an internet connection to download its runtime initially. Offline availability of Python and additional packages is not guaranteed.

## Current Limitations

This is an early beta with intentionally bounded tools:

- Matrices currently support 2×2 operations.
- The spreadsheet currently covers cells A1:F6 and selected functions.
- Probability tools currently cover normal and binomial distributions.
- Geometry currently focuses on measurements between two points.
- Symbolic tools support selected rules, not a complete computer algebra system.
- Python is a single-script scratchpad, not a multi-cell notebook.
- Classroom tools support lesson sharing, not student accounts or live classroom management.
- Numerical solvers may not find every solution.

Known issues from testing include:

- The graph export panel may fail to open.
- The main calculator’s solver may require a second click after editing.
- Shared graph links may not preserve every expression or slider setting.
- Some long mathematical expressions may be clipped on narrow screens.

Independently check important results. This beta is not intended for safety-critical calculations.

## Reporting Problems

Please open a GitHub issue and include:

1. The tool or feature you used
2. The expression or values you entered
3. What you expected to happen
4. What actually happened
5. Your browser and device
6. A screenshot, if helpful

Avoid including personal or sensitive information in public reports.

## About

Spectrum Calc aims to make useful mathematics tools freely accessible through a web browser.

It is an independent project and is not affiliated with or endorsed by Texas Instruments, HP, or Casio.
