import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { BrainrotLayout } from "./components/BrainrotLayout";

import RotPage from "./pages/RotPage";
import RehabPage from "./pages/RehabPage";
import ProfilePage from "./pages/ProfilePage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<BrainrotLayout />}>
          <Route index element={<Navigate to="/rot" replace />} />
          <Route path="rot" element={<RotPage />} />
          <Route path="rehab" element={<RehabPage />} />
          <Route path="rehab/:seedId" element={<RehabPage />} />
          <Route path="profile/:npub" element={<ProfilePage />} />
        </Route>
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;