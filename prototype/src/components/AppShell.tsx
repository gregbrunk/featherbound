import { NavLink, Link, Outlet } from 'react-router-dom';
import Tuft from './Tuft';
import Icon from './Icon';

const NAV = [
  { to: '/', label: 'Library', icon: 'book', end: true },
  { to: '/add', label: 'Add a book', short: 'Add', icon: 'plus' },
  { to: '/settings?tab=usage', match: '/settings', label: 'Usage', icon: 'chart' },
  { to: '/settings?tab=access', match: '/settings', label: 'Settings', icon: 'gear' },
];

export default function AppShell() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Featherbound home">
            <Tuft size={40} still />
            <span className="brand-name">Featherbound</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Library</NavLink>
            <NavLink to="/add">Add a book</NavLink>
            <NavLink to="/settings?tab=usage" className={() => (location.hash.includes('/settings') && location.hash.includes('usage') ? 'active' : '')}>
              Usage
            </NavLink>
            <NavLink to="/settings?tab=access" className={() => (location.hash.includes('/settings') && !location.hash.includes('usage') ? 'active' : '')}>
              Settings
            </NavLink>
          </nav>
          <div className="spacer" />
          <Link to="/design" className="btn btn-ghost btn-sm hide-mobile">
            <Icon name="feather" size={16} /> Meet Tuft
          </Link>
          <div className="avatar" title="greg.brunk@gmail.com">G</div>
        </div>
      </header>
      <Outlet />
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.label}
            to={n.to}
            end={n.end}
            className={({ isActive }) => {
              if (n.match) {
                const onSettings = location.hash.includes('/settings');
                const usage = location.hash.includes('usage');
                return onSettings && (n.label === 'Usage' ? usage : !usage) ? 'active' : '';
              }
              return isActive ? 'active' : '';
            }}
          >
            <Icon name={n.icon} size={22} />
            {n.short ?? n.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
