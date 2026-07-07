import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: boolean;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="page-header no-print">
      <div className="page-header-left">
        {back && (
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
            ←
          </button>
        )}
        <h1>{title}</h1>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
