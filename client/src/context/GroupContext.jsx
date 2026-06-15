import { createContext, useState, useCallback } from 'react';
import { getGroup } from '../api/groups';
import toast from 'react-hot-toast';

export const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const [currentGroup, setCurrentGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGroup = useCallback(async (groupId) => {
    setLoading(true);
    try {
      const res = await getGroup(groupId);
      setCurrentGroup(res.data.group);
      setMembers(res.data.members || []);
    } catch (err) {
      toast.error('Failed to load group');
      setCurrentGroup(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearGroup = useCallback(() => {
    setCurrentGroup(null);
    setMembers([]);
  }, []);

  return (
    <GroupContext.Provider
      value={{ currentGroup, members, loading, fetchGroup, clearGroup }}
    >
      {children}
    </GroupContext.Provider>
  );
}
