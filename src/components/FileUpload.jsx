import React, { useRef, useState } from 'react';

export default function FileUpload({ onFileLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

  const handleFile = (file) => {
    setError('');
    if (!file) return;
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
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-10 text-center animate-fade-in-up">
        <img src={logoUrl} alt="Spaceshiptrip logo" className="w-24 h-24 mx-auto mb-5 object-contain drop-shadow-lg" />

        <h1 className="font-mono text-4xl font-semibold text-steel-50 leading-tight">
          Project<br />
          <span className="text-sky-400">Timeline</span>
        </h1>
        <p className="mt-3 text-steel-400 text-sm max-w-xs">
          Drop your Microsoft Project XML export to visualize tasks, milestones &amp; resources
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative w-full max-w-xl border-2 rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200 animate-fade-in-up
          ${dragging ? 'border-sky-400 bg-sky-400/10' : 'border-steel-700 hover:border-steel-500 bg-steel-950/50'}
        `}
        style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xml,.mpp,.mpx" className="hidden"
          onChange={(e) => handleFile(e.target.files[0])} />

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
              <span key={ext} className="font-mono text-xs bg-steel-800 text-steel-400 px-2 py-1 rounded">{ext}</span>
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
          <div className="flex gap-3"><span className="font-mono text-sky-600 shrink-0">01</span><span>Open your project in Microsoft Project</span></div>
          <div className="flex gap-3"><span className="font-mono text-sky-600 shrink-0">02</span><span>Go to File → Save As → choose "XML Format (*.xml)"</span></div>
          <div className="flex gap-3"><span className="font-mono text-sky-600 shrink-0">03</span><span>Drop the saved .xml file above</span></div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
        <img src={logoUrl}   alt="logo" className="w-6 h-6 object-contain opacity-60" />
        <a href="https://github.com/spaceshiptrip/msp-viewer" target="_blank" rel="noopener noreferrer"
          className="font-mono text-xs text-steel-600 hover:text-sky-400 transition-colors flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          spaceshiptrip / msp-viewer
        </a>
      </div>
    </div>
  );
}
