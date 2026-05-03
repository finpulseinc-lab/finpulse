export function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-10 h-14 bg-slate-800 shadow-sm flex items-center px-6">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-600 text-white text-xs font-bold select-none">
          FP
        </span>
        <span className="text-white font-semibold text-sm">FinPulse</span>
        <span className="text-slate-500 text-sm">— File Manager</span>
      </div>
    </nav>
  );
}
