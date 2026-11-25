import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthContext";

export function RequerLogin() {
  const { usuario } = useAuth();
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}
