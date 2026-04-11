import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "בית" },
  { to: "/compare", label: "השוואה" },
  { to: "/company/iai", label: "תע״א" },
  { to: "/company/elbit", label: "אלביט" },
  { to: "/company/rafael", label: "רפאל" },
  { to: "/company/lockheed", label: "לוקהיד" },
  { to: "/company/rtx", label: "RTX" },
  { to: "/company/leonardo", label: "לאונרדו" },
  { to: "/company/bae", label: "BAE" },
  { to: "/company/rheinmetall", label: "Rheinmetall" },
  { to: "/company/thales", label: "Thales" },
  { to: "/company/gd", label: "GD" },
  { to: "/company/northrop", label: "נורת׳רופ" },
  { to: "/company/l3harris", label: "L3Harris" },
  { to: "/company/boeing", label: "בואינג" },
  { to: "/company/embraer", label: "אמבראיר" },
  { to: "/company/saab", label: "סאאב" },
];

function linkActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SiteNav() {
  const loc = useLocation();
  return (
    <nav className="site-nav" aria-label="ניווט ראשי">
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={
            linkActive(loc.pathname, to) ? "site-nav__link site-nav__link--active" : "site-nav__link"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
