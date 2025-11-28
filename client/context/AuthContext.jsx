import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  // Check auth
  const checkAuth = async () => {
    try {
      const { data } = await axios.get("/api/auth/check");
      if (data.success) setAuthUser(data.user);
    } catch (err) {
      toast.error(err?.message || "Auth check failed");
    }
  };

  // Login
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        if (data.token) {
          axios.defaults.headers.common["token"] = data.token;
          setToken(data.token);
          localStorage.setItem("token", data.token);
        }
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err?.message || "Login failed");
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    delete axios.defaults.headers.common["token"];
    if (socket?.connected) socket.disconnect();
    setSocket(null);
    toast.success("Logged out");
  };

  // Socket connect when authUser available
  useEffect(() => {
    if (!authUser) return;
    if (socket?.connected) return;

    const newSocket = io(backendUrl, { query: { userId: authUser._id } });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
    });

    newSocket.on("getOnlineUsers", (users) => setOnlineUsers(users));

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocket((s) => (s === newSocket ? null : s));
    });

    return () => newSocket.disconnect();
  }, [authUser]);

  useEffect(() => {
    if (token) axios.defaults.headers.common["token"] = token;
    else delete axios.defaults.headers.common["token"];
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{ authUser, socket, onlineUsers, login, logout, axios }}
    >
      {children}
    </AuthContext.Provider>
  );
};
