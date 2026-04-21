import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';

interface VolunteerRecord {
  id: string;
  volunteerId: string;
  volunteerName: string;
  needId: string;
  userName: string;
  userQuery: string;
  acceptedAt: any;
}

export default function VolunteerList() {
  const [records, setRecords] = useState<VolunteerRecord[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'volunteerRecords'), orderBy('acceptedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VolunteerRecord));
      setRecords(recordData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'volunteerRecords'));

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white uppercase tracking-tight">Volunteer's List</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-zinc-400">
          <thead className="bg-zinc-800 uppercase text-[10px] tracking-widest">
            <tr>
              <th className="px-4 py-3">Volunteer</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Query</th>
              <th className="px-4 py-3">Date/Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {records.map(record => (
              <tr key={record.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3 font-bold text-white">{record.volunteerName}</td>
                <td className="px-4 py-3">{record.userName}</td>
                <td className="px-4 py-3 truncate max-w-[200px]">{record.userQuery}</td>
                <td className="px-4 py-3 font-mono">
                  {record.acceptedAt ? format(record.acceptedAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
