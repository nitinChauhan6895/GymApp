import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Campaign } from '../types';
import { downloadBlob, formatDateTime, nowISO } from '../utils';
import PageHeader from '../components/PageHeader';

const TEMPLATES = [
  { key: 'bold', label: 'Bold', bg: ['#0f172a', '#1e293b'], accent: '#f97316' },
  { key: 'energy', label: 'Energy', bg: ['#7c2d12', '#ea580c'], accent: '#fde68a' },
  { key: 'fresh', label: 'Fresh', bg: ['#064e3b', '#059669'], accent: '#fbbf24' },
] as const;

type TemplateKey = (typeof TEMPLATES)[number]['key'];

interface PosterData {
  template: TemplateKey;
  title: string;
  offer: string;
  price: string;
  dates: string;
  gymName: string;
  phone: string;
  logo?: string;
}

function drawPoster(canvas: HTMLCanvasElement, data: PosterData) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const tpl = TEMPLATES.find((t) => t.key === data.template) || TEMPLATES[0];

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, tpl.bg[0]);
  grad.addColorStop(1, tpl.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // decorative dumbbell strokes
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 40;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-50, H - 180);
  ctx.lineTo(W * 0.45, H - 320);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.6, 140);
  ctx.lineTo(W + 60, 260);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';

  const drawText = (text: string, y: number, font: string, color = '#ffffff', maxWidth = W - 160) => {
    if (!text) return y;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y, maxWidth);
    return y;
  };

  // gym name band
  drawText(data.gymName.toUpperCase(), 170, '600 52px system-ui, sans-serif', 'rgba(255,255,255,0.9)');
  ctx.fillStyle = tpl.accent;
  ctx.fillRect(W / 2 - 90, 205, 180, 8);

  // title & offer
  drawText(data.title.toUpperCase(), 430, '800 110px system-ui, sans-serif', '#ffffff');
  drawText(data.offer, 560, '600 62px system-ui, sans-serif', tpl.accent);

  // price capsule
  if (data.price) {
    ctx.font = '800 96px system-ui, sans-serif';
    const tw = Math.min(ctx.measureText(data.price).width, W - 300);
    const pad = 60;
    const bx = W / 2 - tw / 2 - pad;
    const by = 660;
    ctx.fillStyle = tpl.accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + pad * 2, 160, 80);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillText(data.price, W / 2, by + 112, W - 320);
  }

  drawText(data.dates, 940, '500 46px system-ui, sans-serif', 'rgba(255,255,255,0.85)');

  // footer
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, H - 170, W, 170);
  drawText(data.phone ? `📞 ${data.phone}` : '', H - 70, '600 48px system-ui, sans-serif');

  if (data.logo) {
    const img = new Image();
    img.onload = () => {
      const size = 110;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, 60 + size / 2 - 10, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, W / 2 - size / 2, 50 - 10, size, size);
      ctx.restore();
    };
    img.src = data.logo;
  }
}

export default function Campaigns() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const campaigns = useLiveQuery(() => db.campaigns.orderBy('createdAt').reverse().limit(20).toArray(), []) || [];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [template, setTemplate] = useState<TemplateKey>('bold');
  const [title, setTitle] = useState('New Year Offer');
  const [offer, setOffer] = useState('Flat 20% off on annual plans');
  const [price, setPrice] = useState('₹7,999 / year');
  const [dates, setDates] = useState('Valid till 31 Jan');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');

  useEffect(() => {
    if (settings) {
      setGymName((g) => g || settings.gymName);
      setPhone((p) => p || settings.phone);
    }
  }, [settings]);

  const data: PosterData = { template, title, offer, price, dates, gymName, phone, logo: settings?.logo };

  useEffect(() => {
    if (canvasRef.current) drawPoster(canvasRef.current, data);
  });

  async function exportImage(saveHistory = true) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      downloadBlob(blob, `${title.replace(/\s+/g, '-').toLowerCase() || 'campaign'}.png`);
      if (saveHistory) {
        await db.campaigns.add({ title, template, offer, price, dates, createdAt: nowISO() });
      }
    }, 'image/png');
  }

  function loadCampaign(c: Campaign) {
    setTitle(c.title);
    setTemplate((c.template as TemplateKey) || 'bold');
    setOffer(c.offer);
    setPrice(c.price);
    setDates(c.dates);
  }

  return (
    <div className="page">
      <PageHeader title="Campaigns" />
      <div className="chip-row">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            className={'chip' + (template === t.key ? ' chip-active' : '')}
            onClick={() => setTemplate(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="poster-preview">
        <canvas ref={canvasRef} className="poster-canvas" />
      </div>

      <div className="form">
        <div className="field-row">
          <label className="field">
            <span>Offer Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Price</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Offer Details</span>
          <input value={offer} onChange={(e) => setOffer(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Validity / Dates</span>
            <input value={dates} onChange={(e) => setDates(e.target.value)} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Gym Name</span>
          <input value={gymName} onChange={(e) => setGymName(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-block" onClick={() => exportImage()}>
          ⬇️ Export Poster Image
        </button>
      </div>

      <h2 className="section-title">Campaign History</h2>
      <div className="card">
        {campaigns.length === 0 && <p className="muted center pad">Exported posters appear here.</p>}
        {campaigns.map((c) => (
          <button key={c.id} className="list-row list-row-btn" onClick={() => loadCampaign(c)}>
            <div>
              <strong>{c.title}</strong>
              <span className="muted block">{c.offer}</span>
            </div>
            <span className="muted">{formatDateTime(c.createdAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
