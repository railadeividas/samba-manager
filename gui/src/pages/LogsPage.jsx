import React, { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getLogs } from '../services/infoService';

const LogsPage = () => {
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState('');
  const [lines, setLines] = useState([]);
  const [count, setCount] = useState(200);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getLogs(file, count);
      setFiles(data.files || []);
      if (!file && data.file) setFile(data.file);
      setLines(data.lines || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [file, count]);

  useEffect(() => {
    load();
    if (!auto) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [auto, load]);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Logs</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="log-file">File</InputLabel>
            <Select labelId="log-file" label="File" value={file} onChange={(e) => setFile(e.target.value)}>
              {files.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="log-lines">Lines</InputLabel>
            <Select labelId="log-lines" label="Lines" value={count} onChange={(e) => setCount(e.target.value)}>
              {[100, 200, 500, 1000].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={auto} onChange={(e) => setAuto(e.target.checked)} />} label="Follow" />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {files.length === 0 && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>No Samba log files were found yet.</Alert>
      )}
      <Paper
        ref={box}
        sx={{ p: 2, height: '65vh', overflow: 'auto', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre-wrap', bgcolor: 'grey.900', color: 'grey.100' }}
      >
        {lines.join('\n')}
      </Paper>
    </Box>
  );
};

export default LogsPage;
