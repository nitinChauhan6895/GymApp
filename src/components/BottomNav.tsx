import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/members', label: 'Members', icon: '👥' },
  { to: '/renewals', label: 'Renewals', icon: '🔄' },
  { to: '/campaigns', label: 'Campaigns', icon: '📢' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav no-print">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
