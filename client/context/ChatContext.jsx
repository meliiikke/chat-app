import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});

  const { socket, axios } = useContext(AuthContext);

  // Users fetch
  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (err) {
      toast.error(err?.message || "Failed to fetch users");
    }
  }, [axios]);

  // Messages fetch
  const getMessages = useCallback(
    async (userId) => {
      if (!userId) return;
      try {
        const { data } = await axios.get(`/api/messages/${userId}`);
        if (data.success) setMessages(data.messages || []);
      } catch (err) {
        toast.error(err?.message || "Failed to fetch messages");
      }
    },
    [axios]
  );

  // Send message
  const sendMessage = async (messageData) => {
    if (!selectedUser) return toast.error("No user selected");
    try {
      const { data } = await axios.post(`/api/messages/send/${selectedUser._id}`, messageData);
      if (data.success) setMessages((prev) => [...prev, data.newMessage]);
    } catch (err) {
      toast.error(err?.message || "Failed to send message");
    }
  };

  // Incoming message handler
  const handleIncomingMessage = useCallback(
    (newMessage) => {
      if (!newMessage) return;

      if (selectedUser && newMessage.senderId === selectedUser._id) {
        setMessages((prev) => [...prev, { ...newMessage, seen: true }]);
        // mark as seen backend
        axios.put(`/api/messages/mark/${newMessage._id}`).catch(console.error);
      } else {
        setUnseenMessages((prev) => ({
          ...prev,
          [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
        }));
      }
    },
    [selectedUser, axios]
  );

  // Subscribe socket
  useEffect(() => {
    if (!socket) return;
    socket.on("newMessage", handleIncomingMessage);
    return () => socket.off("newMessage", handleIncomingMessage);
  }, [socket, handleIncomingMessage]);

  // Selected user changes
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }
    getMessages(selectedUser._id);

    // reset unseen
    setUnseenMessages((prev) => {
      const copy = { ...prev };
      if (copy[selectedUser._id]) delete copy[selectedUser._id];
      return copy;
    });
  }, [selectedUser, getMessages]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        users,
        selectedUser,
        setSelectedUser,
        getUsers,
        getMessages,
        sendMessage,
        unseenMessages,
        setUnseenMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
