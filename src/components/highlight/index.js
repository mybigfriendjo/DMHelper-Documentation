import React from 'react';

function LightHighlight ({ children, color }) {
  return (
    <span
      className="codestylelight"
      style={{
        color: "#1f1f1f",
        backgroundColor: color,
      }}
    >
      {children}
    </span>
  );
}

function DarkHighlight ({ children, color }) {
  return (
    <span
      className="codestyledark"
      style={{
        color: "#e0e0e0",
        backgroundColor: color,
      }}
    >
      {children}
    </span>
  );
}

export { LightHighlight, DarkHighlight };