import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getSessions } from '../services/infoService';

const SessionsPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await getSessions());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    if (!auto) return undefined;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [auto, load]);

  const sessions = data?.sessions || [];
  const connections = data?.connections || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Connected clients</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel control={<Switch checked={auto} onChange={(e) => setAuto(e.target.checked)} />} label="Auto-refresh" />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && data.available === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Session information is not available: {data.error}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>Sessions ({sessions.length})</Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell><TableCell>Machine</TableCell><TableCell>Protocol</TableCell>
              <TableCell>Encryption</TableCell><TableCell>Signing</TableCell><TableCell>Since</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">Nobody is connected.</TableCell></TableRow>
            )}
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.username}</TableCell><TableCell>{s.machine}</TableCell><TableCell>{s.protocol}</TableCell>
                <TableCell>{s.encryption || '-'}</TableCell><TableCell>{s.signing || '-'}</TableCell>
                <TableCell>{s.since ? new Date(s.since).toLocaleString() : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" gutterBottom>Share connections ({connections.length})</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Share</TableCell><TableCell>Machine</TableCell><TableCell>Since</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {connections.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center">No open shares.</TableCell></TableRow>
            )}
            {connections.map((c, i) => (
              <TableRow key={`${c.session}-${c.share}-${i}`}>
                <TableCell>{c.share}</TableCell><TableCell>{c.machine}</TableCell>
                <TableCell>{c.since ? new Date(c.since).toLocaleString() : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {data && <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Open files: {data.openFiles}</Typography>}
    </Box>
  );
};

export default SessionsPage;
