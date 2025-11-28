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

  // Check if user is authenticated and if so set the user data and connect the socket
  const checkAuth = async () => {
    try {
      const { data } = await axios.get("/api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      // Eğer token yoksa ya da geçersizse burada hata gelecektir; sadece göster
      toast.error(error?.message || "Auth check failed");
    }
  };

  // Login function to handle user authentication and socket connection
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        // önce token'ı ayarla ki connect sırasında header gerekirse mevcut olsun
        if (data.token) {
          axios.defaults.headers.common["token"] = data.token;
          setToken(data.token);
          localStorage.setItem("token", data.token);
        }
        connectSocket(data.userData);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error?.message || "Login failed");
    }
  };

  // Logout function to handle user logout and socket disconnection
  const logout = async () => {
    try {
      localStorage.removeItem("token");
      setToken(null);
      setAuthUser(null);
      setOnlineUsers([]);
      // delete header instead of setting to null
      delete axios.defaults.headers.common["token"];
      toast.success("Logged out successfully");
      if (socket?.connected) {
        socket.disconnect();
      }
      setSocket(null);
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout failed");
    }
  };

  // Update profile function to handle user profile updates
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error?.message || "Update failed");
    }
  };

  // Connect socket function to handle socket connection and online users updates
  const connectSocket = (userData) => {
    if (!userData || socket?.connected) return;
    // If your server expects a token for socket auth, you can add auth: { token } here.
    const newSocket = io(backendUrl, {
      query: {
        userId: userData._id,
      },
      // auth: { token } // <-- uncomment if server reads token from socket.handshake.auth.token
    });
    // .connect() is fine but io(...) usually connects immediately
    setSocket(newSocket);
    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
    });
    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });
    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocket((s) => (s === newSocket ? null : s));
    });
  };

  // IMPORTANT: keep axios header in sync with token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["token"] = token;
    } else {
      delete axios.defaults.headers.common["token"];
    }
  }, [token]);

  // On mount, try to validate existing token and populate user
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
