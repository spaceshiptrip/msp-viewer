import React, { useState } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Timeline from './components/Timeline.jsx';
import { parseMsProjectXml } from './utils/msProjectParser.js';

export default function App() {
  const [project, setProject] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleFileLoaded = (xmlString, name) => {
    setError('');
    try {
      const parsed = parseMsProjectXml(xmlString);
      if (!parsed.tasks || parsed.tasks.length === 0) {
        setError('No tasks found in this XML file. Make sure it\'s a valid Microsoft Project XML export.');
        return;
      }
      setFileName(name);
      setProject(parsed);
    } catch (err) {
      setError('Could not parse this file: ' + err.message);
    }
  };

  const handleReset = () => {
    setProject(null);
    setFileName('');
    setError('');
  };

  if (project) {
    return <Timeline project={project} fileName={fileName} onReset={handleReset} />;
  }

  return (
    <>
      <FileUpload onFileLoaded={handleFileLoaded} />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-sm px-6 py-3 rounded-lg shadow-xl max-w-md text-center">
          {error}
        </div>
      )}
    </>
  );
}
