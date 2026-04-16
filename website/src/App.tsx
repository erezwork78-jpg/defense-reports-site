import { Route, Routes } from "react-router-dom";
import { ComparePage } from "./pages/ComparePage";
import { ElbitCompanyPage } from "./pages/ElbitCompanyPage";
import { HomePage } from "./pages/HomePage";
import { IaiCompanyPage } from "./pages/IaiCompanyPage";
import { LockheedCompanyPage } from "./pages/LockheedCompanyPage";
import { BaeCompanyPage } from "./pages/BaeCompanyPage";
import { LeonardoCompanyPage } from "./pages/LeonardoCompanyPage";
import { RafaelCompanyPage } from "./pages/RafaelCompanyPage";
import { RheinmetallCompanyPage } from "./pages/RheinmetallCompanyPage";
import { RtxCompanyPage } from "./pages/RtxCompanyPage";
import { ThalesCompanyPage } from "./pages/ThalesCompanyPage";
import { GdCompanyPage } from "./pages/GdCompanyPage";
import { NorthropCompanyPage } from "./pages/NorthropCompanyPage";
import { L3harrisCompanyPage } from "./pages/L3harrisCompanyPage";
import { BoeingCompanyPage } from "./pages/BoeingCompanyPage";
import { EmbraerCompanyPage } from "./pages/EmbraerCompanyPage";
import { SaabCompanyPage } from "./pages/SaabCompanyPage";
import { AiDefensePage } from "./pages/AiDefensePage";
import { OrgFinanceQuestionsPage } from "./pages/OrgFinanceQuestionsPage";

export default function App() {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ai-defense" element={<AiDefensePage />} />
        <Route path="/org-finance-questions" element={<OrgFinanceQuestionsPage />} />
        <Route path="/org-finance" element={<OrgFinanceQuestionsPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/company/iai" element={<IaiCompanyPage />} />
        <Route path="/company/elbit" element={<ElbitCompanyPage />} />
        <Route path="/company/rafael" element={<RafaelCompanyPage />} />
        <Route path="/company/lockheed" element={<LockheedCompanyPage />} />
        <Route path="/company/rtx" element={<RtxCompanyPage />} />
        <Route path="/company/leonardo" element={<LeonardoCompanyPage />} />
        <Route path="/company/bae" element={<BaeCompanyPage />} />
        <Route path="/company/rheinmetall" element={<RheinmetallCompanyPage />} />
        <Route path="/company/thales" element={<ThalesCompanyPage />} />
        <Route path="/company/gd" element={<GdCompanyPage />} />
        <Route path="/company/northrop" element={<NorthropCompanyPage />} />
        <Route path="/company/l3harris" element={<L3harrisCompanyPage />} />
        <Route path="/company/boeing" element={<BoeingCompanyPage />} />
        <Route path="/company/embraer" element={<EmbraerCompanyPage />} />
        <Route path="/company/saab" element={<SaabCompanyPage />} />
      </Routes>
    </div>
  );
}
