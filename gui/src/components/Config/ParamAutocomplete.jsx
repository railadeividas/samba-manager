import React, { useState, useEffect } from 'react';
import {
  TextField,
  Autocomplete,
  Box,
  Typography,
  Chip,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  getParametersBySection,
  getParameterDescription,
  getDescriptionsBySection
} from '../../utils/sambaParameters';

/**
 * Reusable Parameter Autocomplete component for Samba configuration
 * Shows parameter descriptions and examples in the dropdown
 *
 * @param {Object} props
 * @param {string} props.sectionName - Name of the Samba section (global, homes, printers, etc.)
 * @param {string} props.value - Current parameter value
 * @param {Function} props.onChange - Callback when parameter changes
 * @param {boolean} props.disabled - Whether the component is disabled
 * @param {Object} props.textFieldProps - Additional props to pass to TextField
 */
const ParamAutocomplete = ({
  sectionName,
  value,
  onChange,
  disabled = false,
  textFieldProps = {}
}) => {
  const [availableParams, setAvailableParams] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [paramDescriptions, setParamDescriptions] = useState({});

  // Load available parameters and descriptions based on section
  useEffect(() => {
    const params = getParametersBySection(sectionName);
    const descriptions = getDescriptionsBySection(sectionName);

    setAvailableParams(params);
    setParamDescriptions(descriptions);
  }, [sectionName]);

  // Custom filter function to allow freeform text entry but prioritize matches
  const filterOptions = (options, { inputValue }) => {
    const filtered = options.filter(option =>
      option.toLowerCase().includes(inputValue.toLowerCase())
    );

    // If user types something not in the list, allow it
    if (inputValue !== '' && !filtered.includes(inputValue) && !options.includes(inputValue)) {
      filtered.push(inputValue);
    }

    return filtered;
  };

  return (
    <Autocomplete
      value={value}
      onChange={(event, newValue) => {
        onChange(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(event, newValue) => {
        setInputValue(newValue);
      }}
      options={availableParams}
      filterOptions={filterOptions}
      freeSolo
      disabled={disabled}
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          label="Parameter"
          placeholder="Enter or select parameter"
          size="small"
          variant="outlined"
          {...textFieldProps}
        />
      )}
      renderOption={(props, option) => {
        const paramInfo = getParameterDescription(option);

        return (
          <ListItem {...props} sx={{ py: 1 }}>
            <Box sx={{ width: '100%' }}>
              <Typography
                variant="subtitle2"
                color="primary.main"
                sx={{ display: 'block', mb: 0.5 }}
              >
                {option}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                {paramInfo?.description || 'No description available'}
              </Typography>

              {paramInfo?.examples && paramInfo.examples.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
                    Examples:
                  </Typography>
                  {paramInfo.examples.map((example, index) => (
                    <Chip
                      key={index}
                      label={example}
                      size="small"
                      variant="outlined"
                      color="secondary"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        height: 20,
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </ListItem>
        );
      }}
      ListboxProps={{
        sx: {
          maxHeight: 350,
          '& .MuiAutocomplete-option': {
            borderBottom: '1px dashed rgba(0,0,0,0.1)'
          }
        }
      }}
    />
  );
};

export default ParamAutocomplete;
