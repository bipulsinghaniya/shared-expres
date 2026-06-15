import { useContext } from 'react';
import { GroupContext } from '../context/GroupContext';

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within GroupProvider');
  return ctx;
}
