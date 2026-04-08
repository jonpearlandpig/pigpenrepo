import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "@/pages/Index";
import TourDetail from "@/pages/TourDetail";
import VenueDetail from "@/pages/VenueDetail";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tours" replace />} />
        <Route path="/tours" element={<Index />} />
        <Route path="/tours/:tourId" element={<TourDetail />} />
        <Route path="/tours/:tourId/venues/:venueId" element={<VenueDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
