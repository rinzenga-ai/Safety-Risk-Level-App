import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const BACKEND_URL = 'https://safety-risk-backend.onrender.com';

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/upload`, formData);
      setPolicies(response.data.sort((a, b) => b.riskScore - a.riskScore));
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload or process file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (policies.length === 0) return;

    try {
      const response = await axios.post(`${BACKEND_URL}/api/download`, policies, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Policy_Report.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    }
  };

  const formatValue = (key, value) => {
    if (["Incurred Amount", "Inforce Premium", "Inforce Exposure"].includes(key)) {
      const num = parseFloat(value.toString().replace(/[^0-9.-]/g, '')) || 0;
      return `$${num.toLocaleString()}`;
    }

    if (["Loss Ratio", "2021 - 2025 Loss Ratio"].includes(key)) {
      const num = parseFloat(value.toString().replace(/[^0-9.]/g, '')) || 0;
      return `${num.toFixed(1)}%`;
    }

    return value;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Upload Policy Spreadsheet</h1>

      {loading && <p style={{ color: 'blue' }}>Uploading and processing... Please wait.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file}>Upload</button>

      {policies.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Policy Risk Scores</h2>
          <button onClick={handleDownload} style={{ marginBottom: '10px' }}>
            Export to Excel
          </button>

          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif' }}>
            <thead>
              <tr style={{ backgroundColor: '#333', color: '#fff' }}>
                {Object.keys(policies[0]).map((key) => (
                  <th
                    key={key}
                    style={{
                      border: '1px solid #ccc',
                      padding: '6px 8px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      maxWidth: '150px',
                    }}
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((policy, index) => (
                <tr key={index}>
                  {Object.entries(policy).map(([key, val], idx) => (
                    <td
                      key={idx}
                      style={{
                        border: '1px solid #ccc',
                        padding: '4px 8px',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        maxWidth: '150px',
                        backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff',
                      }}
                    >
                      {formatValue(key, val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
