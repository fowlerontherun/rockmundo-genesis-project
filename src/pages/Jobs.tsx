import { Navigate } from "react-router-dom";

// Stable URL referenced from in-game CTAs (e.g. prison debt warning).
// Jobs are managed via the Work Booking surface, so we redirect there.
export default function Jobs() {
  return <Navigate to="/booking/work" replace />;
}
