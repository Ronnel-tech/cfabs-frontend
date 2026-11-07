import { useEffect, useId, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Button } from './ui';
import { qrIdentifier } from '../lib/qr';

function Camera({ onRead, onClose }: { onRead: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onRead);
  const [error, setError] = useState('');
  useEffect(() => { callback.current = onRead; }, [onRead]);
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    let controls: IScannerControls | undefined;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning needs HTTPS or localhost. Paste a label or upload an image instead.');
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
        controls = await new BrowserQRCodeReader().decodeFromStream(stream, video.current!, (result, _error, scanner) => {
          if (!result || disposed) return;
          scanner.stop();
          stream?.getTracks().forEach(track => track.stop());
          disposed = true;
          callback.current(result.getText());
        });
        if (disposed) controls.stop();
      } catch (failure) {
        stream?.getTracks().forEach(track => track.stop());
        if (!disposed) setError(failure instanceof Error && failure.message.startsWith('Camera scanning') ? failure.message : 'Could not open the camera. Check camera permission, or upload an image or paste the label.');
      }
    }
    void start();
    return () => { disposed = true; controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
  }, []);
  return <div className="qr-camera">
    {error ? <p className="notice notice-error" role="alert">{error}</p> : <><video ref={video} muted playsInline aria-label="Asset QR camera preview" /><p className="muted" role="status">Point the camera at one CFABS asset label.</p></>}
    <Button type="button" variant="secondary" onClick={onClose}>Stop camera</Button>
  </div>;
}

export default function QrScanner({ onRead, disabled = false, onBusyChange }: { onRead: (identifier: string) => Promise<void>; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [camera, setCamera] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function read(raw: string) {
    if (busy.current || disabledRef.current) return;
    busy.current = true; setPending(true); onBusyChange?.(true); setError(''); setCamera(false);
    try { await onRead(qrIdentifier(raw)); if (mounted.current) setValue(''); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not read this label.'); }
    finally { busy.current = false; if (mounted.current) { setPending(false); onBusyChange?.(false); } }
  }
  async function image(file: File) {
    if (busy.current || disabledRef.current) return;
    if (file.size > 10 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Choose a PNG, JPEG, or WebP image up to 10 MB.'); return; }
    busy.current = true; setPending(true); onBusyChange?.(true); setError(''); setCamera(false);
    const url = URL.createObjectURL(file);
    let decoded = '';
    try { const { BrowserQRCodeReader } = await import('@zxing/browser'); decoded = (await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText(); }
    catch { if (mounted.current) setError('No readable QR code found. Try a clearer image or paste the label.'); }
    finally { URL.revokeObjectURL(url); busy.current = false; if (mounted.current) { setPending(false); onBusyChange?.(false); } }
    if (decoded && mounted.current) await read(decoded);
  }
  return <div className="qr-scanner" aria-busy={pending}>
    <div className="field"><label htmlFor={`${id}-value`}>Asset QR label</label><input id={`${id}-value`} value={value} maxLength={100} placeholder="Paste cfabs:qr:… or the label identifier" autoComplete="off" spellCheck={false} disabled={disabled || pending} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void read(value); } }} /></div>
    <div className="action-buttons">
      <Button type="button" disabled={disabled || pending || !value.trim()} onClick={() => void read(value)}>{pending ? 'Reading…' : 'Read label'}</Button>
      <Button type="button" variant="secondary" disabled={disabled || pending || camera} onClick={() => { setError(''); setCamera(true); }}>Use camera</Button>
      <div><label htmlFor={`${id}-image`} className="field-label">Or upload a QR image</label><input id={`${id}-image`} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || pending} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void image(file); }} /></div>
    </div>
    {camera && !disabled && <Camera onRead={raw => void read(raw)} onClose={() => setCamera(false)} />}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </div>;
}
