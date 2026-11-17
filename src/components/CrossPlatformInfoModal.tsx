import React from 'react';
import { 
  Monitor, 
  Apple, 
  Terminal, 
  X, 
  CheckCircle2, 
  Package, 
  Layers, 
  Copy, 
  Check 
} from 'lucide-react';

interface CrossPlatformInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrossPlatformInfoModal: React.FC<CrossPlatformInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container cross-platform-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <Monitor className="modal-icon text-indigo" />
            <h3>Cross-Platform Deployment (Windows, macOS, Linux)</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">
            Nexabase Studio is architected with a dual-runtime foundation: pure WebAssembly for instant in-browser execution, and an Electron wrapper for native desktop installation across all operating systems.
          </p>

          {/* OS Grid */}
          <div className="os-support-grid">
            <div className="os-card">
              <div className="os-icon-badge mac">
                <Apple size={22} />
              </div>
              <h4>macOS</h4>
              <p>Apple Silicon (M1/M2/M3/M4) & Intel x86_64</p>
              <span className="os-package-pill">DMG / .app bundle</span>
            </div>

            <div className="os-card">
              <div className="os-icon-badge win">
                <Monitor size={22} />
              </div>
              <h4>Windows</h4>
              <p>Windows 10, Windows 11 (x64 / ARM64)</p>
              <span className="os-package-pill">Setup .exe / Portable</span>
            </div>

            <div className="os-card">
              <div className="os-icon-badge linux">
                <Terminal size={22} />
              </div>
              <h4>Linux</h4>
              <p>Ubuntu, Debian, Fedora, Arch, Alpine</p>
              <span className="os-package-pill">AppImage / .deb / .rpm</span>
            </div>
          </div>

          {/* Execution Options */}
          <div className="deployment-modes">
            <div className="dep-mode-box">
              <div className="dep-header">
                <Layers size={16} className="text-cyan" />
                <strong>1. Local Web Application Mode (Universal)</strong>
              </div>
              <p>Runs directly in any web browser with local WebAssembly SQLite engine. Zero native compilation required.</p>
              <div className="code-snippet-box">
                <code>npm run dev</code>
                <button className="copy-code-btn" onClick={() => copyToClipboard('npm run dev')}>
                  {copiedCmd === 'npm run dev' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="dep-mode-box">
              <div className="dep-header">
                <Package size={16} className="text-emerald" />
                <strong>2. Native Desktop Electron Mode</strong>
              </div>
              <p>Launches Nexabase Studio as a standalone desktop window with native OS menus, file system access, and shortcuts.</p>
              <div className="code-snippet-box">
                <code>npm run electron:dev</code>
                <button className="copy-code-btn" onClick={() => copyToClipboard('npm run electron:dev')}>
                  {copiedCmd === 'npm run electron:dev' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="dep-mode-box">
              <div className="dep-header">
                <CheckCircle2 size={16} className="text-amber" />
                <strong>3. Build Distributable Installers</strong>
              </div>
              <p>Creates distributable binaries for distribution to end users on Windows, macOS, and Linux.</p>
              <div className="code-snippet-box">
                <code>npm run electron:build</code>
                <button className="copy-code-btn" onClick={() => copyToClipboard('npm run electron:build')}>
                  {copiedCmd === 'npm run electron:build' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer-row">
          <button type="button" className="btn primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
