import React, { useRef, useState } from 'react';

export default function FileUpload({ onFileLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (file) => {
    setError('');
    if (!file) return;
    if (!file.name.match(/\.(xml|mpp|mpx)$/i)) {
      // Allow any XML
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        onFileLoaded(e.target.result, file.name);
      } catch (err) {
        setError('Failed to read file: ' + err.message);
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-12 text-center animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-8 bg-sky-400 rounded" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)' }} />
          <span className="font-mono text-xs text-steel-400 tracking-[0.3em] uppercase">MS Project Viewer</span>
        </div>
        <h1 className="font-mono text-4xl font-semibold text-steel-50 leading-tight">
          Project<br />
          <span className="text-sky-400">Timeline</span>
        </h1>
        <p className="mt-4 text-steel-400 text-sm max-w-xs">
          Drop your Microsoft Project XML export to visualize tasks, milestones & resources
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative w-full max-w-xl border-2 rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200 animate-fade-in-up
          ${dragging
            ? 'border-sky-400 bg-sky-400/10'
            : 'border-steel-700 hover:border-steel-500 bg-steel-950/50'}
        `}
        style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.mpp,.mpx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        <div className={`transition-transform duration-200 ${dragging ? 'scale-110' : ''}`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl border-2 border-sky-400/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-steel-300 font-medium">
            {dragging ? 'Release to load' : 'Drop your .xml file here'}
          </p>
          <p className="text-steel-500 text-sm mt-1">or click to browse</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {['.xml', '.mpp (xml export)'].map(ext => (
              <span key={ext} className="font-mono text-xs bg-steel-800 text-steel-400 px-2 py-1 rounded">
                {ext}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm max-w-xl w-full">
          {error}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 max-w-xl w-full animate-fade-in-up" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
        <p className="font-mono text-xs text-steel-600 uppercase tracking-widest mb-3">How to export from MS Project</p>
        <div className="space-y-2 text-sm text-steel-500">
          <div className="flex gap-3">
            <span className="font-mono text-sky-600 shrink-0">01</span>
            <span>Open your project in Microsoft Project</span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-sky-600 shrink-0">02</span>
            <span>Go to File → Save As → choose "XML Format (*.xml)"</span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-sky-600 shrink-0">03</span>
            <span>Drop the saved .xml file above</span>
          </div>
        </div>
      </div>
    </div>
  );
}
