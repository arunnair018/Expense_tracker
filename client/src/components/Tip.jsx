export default function Tip({ label, children }) {
  return (
    <div className="tip-wrapper">
      {children}
      <span className="tip">{label}</span>
    </div>
  );
}
