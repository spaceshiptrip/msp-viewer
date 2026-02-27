# MS Project Timeline Viewer

A sleek Gantt chart viewer for Microsoft Project XML exports. Built with React, Vite, and Tailwind CSS.

## Features

- 📁 Drag & drop or click to upload `.xml` files exported from MS Project
- 📊 Interactive Gantt chart with Days / Weeks / Months view modes
- 🔍 Filter tasks by name
- ➕ Zoom in/out on the timeline
- 📂 Collapsible summary task groups
- 🎯 Milestones shown as diamonds
- ✅ Progress bars on tasks
- 👥 Resource assignment tooltips
- 📍 "Today" marker line
- 🌙 Dark industrial theme

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Then open http://localhost:5173 in your browser.

## How to Export from MS Project

1. Open your project in Microsoft Project
2. Go to **File → Save As**
3. Choose file type: **"XML Format (*.xml)"**
4. Save and drag the `.xml` file onto the viewer

## Project Structure

```
src/
  components/
    FileUpload.jsx     # Drag & drop upload UI
    Timeline.jsx       # Gantt chart component
  utils/
    msProjectParser.js # XML parsing logic
  App.jsx              # Root component
  main.jsx             # Entry point
  index.css            # Global styles
```

## Technical Notes

- Pure client-side — no server needed, files are parsed in-browser
- Uses the browser's native `DOMParser` for XML parsing
- Supports MS Project XML schema (standard export format)
- Tasks with UID=0 (root summary) are automatically excluded
