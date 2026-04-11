import { Link } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";

export function HomePage() {
  return (
    <>
      <SiteNav />
      <header>
        <h1>דוחות כספיים — יצרני ביטחון</h1>
        <p className="muted">בחרו חברה לצפייה במטריקות, גרפים וטבלאות שהוזנו מהדוחות בתיקייה.</p>
      </header>
      <ul className="home-company-list">
        <li>
          <Link to="/compare" className="home-company-link home-company-link--compare">
            <span className="home-company-name">
              השוואת חברות (כולל תע״א, אלביט, רפאל, לוקהיד, RTX, לאונרדו, BAE, Rheinmetall, Thales, GD, נורת׳רופ, L3Harris, בואינג, אמבראיר, סאאב)
            </span>
            <span className="muted home-company-path">דוגמאות תצוגה — בחירת חברות ופורמט</span>
          </Link>
        </li>
        <li>
          <Link to="/company/iai" className="home-company-link">
            <span className="home-company-name">תעשייה אווירית (תע״א)</span>
            <span className="muted home-company-path">01. IAI</span>
          </Link>
        </li>
        <li>
          <Link to="/company/elbit" className="home-company-link">
            <span className="home-company-name">אלביט מערכות</span>
            <span className="muted home-company-path">אלביט</span>
          </Link>
        </li>
        <li>
          <Link to="/company/rafael" className="home-company-link">
            <span className="home-company-name">רפאל</span>
            <span className="muted home-company-path">רפאל</span>
          </Link>
        </li>
        <li>
          <Link to="/company/lockheed" className="home-company-link">
            <span className="home-company-name">לוקהיד מרטין</span>
            <span className="muted home-company-path">Lockheed Martin</span>
          </Link>
        </li>
        <li>
          <Link to="/company/rtx" className="home-company-link">
            <span className="home-company-name">RTX</span>
            <span className="muted home-company-path">RTX</span>
          </Link>
        </li>
        <li>
          <Link to="/company/leonardo" className="home-company-link">
            <span className="home-company-name">לאונרדו (Leonardo)</span>
            <span className="muted home-company-path">Leonardo</span>
          </Link>
        </li>
        <li>
          <Link to="/company/bae" className="home-company-link">
            <span className="home-company-name">BAE Systems</span>
            <span className="muted home-company-path">BAE</span>
          </Link>
        </li>
        <li>
          <Link to="/company/rheinmetall" className="home-company-link">
            <span className="home-company-name">Rheinmetall</span>
            <span className="muted home-company-path">Rheinmetall</span>
          </Link>
        </li>
        <li>
          <Link to="/company/thales" className="home-company-link">
            <span className="home-company-name">Thales</span>
            <span className="muted home-company-path">Thales</span>
          </Link>
        </li>
        <li>
          <Link to="/company/gd" className="home-company-link">
            <span className="home-company-name">ג׳נרל דיינמיקס (General Dynamics)</span>
            <span className="muted home-company-path">General Dynamics</span>
          </Link>
        </li>
        <li>
          <Link to="/company/northrop" className="home-company-link">
            <span className="home-company-name">נורת׳רופ גראמן</span>
            <span className="muted home-company-path">Northrop Grumman</span>
          </Link>
        </li>
        <li>
          <Link to="/company/l3harris" className="home-company-link">
            <span className="home-company-name">L3Harris Technologies</span>
            <span className="muted home-company-path">L3Harris</span>
          </Link>
        </li>
        <li>
          <Link to="/company/boeing" className="home-company-link">
            <span className="home-company-name">בואינג (Boeing)</span>
            <span className="muted home-company-path">Boeing</span>
          </Link>
        </li>
        <li>
          <Link to="/company/embraer" className="home-company-link">
            <span className="home-company-name">אמבראיר (Embraer)</span>
            <span className="muted home-company-path">EMBRAER</span>
          </Link>
        </li>
        <li>
          <Link to="/company/saab" className="home-company-link">
            <span className="home-company-name">סאאב (Saab)</span>
            <span className="muted home-company-path">SaaB — מטריקות ב־MSEK</span>
          </Link>
        </li>
      </ul>
    </>
  );
}
