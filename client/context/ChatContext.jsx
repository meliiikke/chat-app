import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});

  const { socket, axios } = useContext(AuthContext);

  // get all users for sidebar
  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      toast.error(error?.message || "Failed to fetch users");
    }
  }, [axios]);

  // get messages for selected user
  const getMessages = useCallback(
    async (userId) => {
      if (!userId) return;
      try {
        const { data } = await axios.get(`/api/messages/${userId}`);
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch (error) {
        toast.error(error?.message || "Failed to fetch messages");
      }
    },
    [axios]
  );

  // send message to selected user
  const sendMessage = async (messageData) => {
    if (!selectedUser) return toast.error("No user selected");
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      if (data.success) {
        setMessages((prev) => [...prev, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error?.message || "Failed to send message");
    }
  };

  // message handler (stable reference)
  const handleIncomingMessage = useCallback(
    async (newMessage) => {
      if (!newMessage) return;

      // If the incoming message is from the currently selected user -> mark seen & append
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        const msgToAdd = { ...newMessage, seen: true }; // avoid mutating param
        setMessages((prev) => [...prev, msgToAdd]);

        // mark seen on backend (fire & forget but catch errors)
        axios
          .put(`/api/messages/mark/${newMessage._id}`)
          .catch((err) => console.error("Mark seen failed:", err));
      } else {
        // not the active chat -> increment unseen counter
        setUnseenMessages((prev) => ({
          ...prev,
          [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
        }));
      }
    },
    [selectedUser, axios]
  );

  // subscribe / unsubscribe using stable handler
  useEffect(() => {
    if (!socket) return;
    // attach
    socket.on("newMessage", handleIncomingMessage);

    // cleanup
    return () => {
      socket.off("newMessage", handleIncomingMessage);
    };
  }, [socket, handleIncomingMessage]);

  // When selectedUser changes, load its messages and reset unseen count for them
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }
    getMessages(selectedUser._id);

    // reset unseen count for selected user
    setUnseenMessages((prev) => {
      const copy = { ...prev };
      if (copy[selectedUser._id]) delete copy[selectedUser._id];
      return copy;
    });
  }, [selectedUser, getMessages]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
