document.addEventListener('DOMContentLoaded', () => {
    const syncButton = document.getElementById('syncButton');
    const statusDiv = document.getElementById('status');
    const dataOutputDiv = document.getElementById('dataOutput');
    
    // The URL to your published Google Sheet CSV
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgcWwiuMgzw6tonNkr1ahkPOeJqBH1OcTSPQOC7lqVWUtue9CgksQQQn2MVmw89fWJ39c-helCid4v/pub?output=csv';
    
    const rawCsvStorageKey = 'rawSpreadsheetCsvData';
    const jsonDataStorageKey = 'structuredSpreadsheetJsData';

    /**
     * Converts a CSV string to an array of JavaScript objects.
     * Handles quoted fields containing commas and empty cells.
     * @param {string} csv - The CSV string data.
     * @returns {Array<Object>} An array of objects.
     */
    function convertCsvToJs(csv) {
        const trimmedCsv = csv.trim();
        if (!trimmedCsv) return [];

        const lines = trimmedCsv.split('\n');
        if (lines.length === 0) return [];

        // Sanitize headers: trim and remove potential carriage returns
        const headers = lines[0].split(',').map(header => header.trim().replace(/\r$/, ''));
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLineContent = lines[i].trim().replace(/\r$/, '');
            if (!currentLineContent) continue; // Skip empty lines

            const obj = {};
            const values = [];
            let inQuotes = false;
            let currentValue = '';

            for (let char of currentLineContent) {
                if (char === '"' && inQuotes && i + 1 < currentLineContent.length && currentLineContent[i+1] === '"') {
                    // Handle escaped double quotes "" inside a quoted field
                    currentValue += '"';
                    i++; // Skip next quote
                    continue;
                }
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue); // Don't trim here, will trim later
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue); // Add the last value

            // Assign values to object properties based on headers
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                const value = (values[j] !== undefined ? values[j] : '').trim(); // Trim and handle undefined
                obj[header] = value;
            }
            result.push(obj);
        }
        return result;
    }

    /**
     * Displays the JavaScript data (array of objects) as an HTML table.
     * @param {Array<Object>} data - The data to display.
     */
    function displayDataAsTable(data) {
        if (!data || data.length === 0) {
            dataOutputDiv.innerHTML = '<p>No data available to display, or data is empty.</p>';
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headerRow = document.createElement('tr');

        // Create table headers from the keys of the first object
        Object.keys(data[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table rows
        data.forEach(item => {
            const tr = document.createElement('tr');
            Object.keys(data[0]).forEach(headerKey => { // Ensure consistent column order
                const td = document.createElement('td');
                td.textContent = item[headerKey] !== undefined ? item[headerKey] : ''; // Handle potentially missing keys in some objects
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        dataOutputDiv.innerHTML = ''; // Clear previous content
        dataOutputDiv.appendChild(table);
    }

    /**
     * Loads data from local storage and displays it.
     */
    function loadAndDisplayFromLocalStorage() {
        statusDiv.textContent = 'Attempting to load data from local storage...';
        const storedJsDataString = localStorage.getItem(jsonDataStorageKey);

        if (storedJsDataString) {
            try {
                const storedJsData = JSON.parse(storedJsDataString);
                if (storedJsData && storedJsData.length > 0) {
                    displayDataAsTable(storedJsData);
                    statusDiv.textContent = `Data successfully loaded from local storage. ${storedJsData.length} records found.`;
                } else {
                     dataOutputDiv.innerHTML = '<p>Local storage contains empty data. Sync to fetch new data.</p>';
                     statusDiv.textContent = 'Local storage data is empty.';
                }
            } catch (error) {
                statusDiv.textContent = 'Error parsing data from local storage. It might be corrupted.';
                console.error('Error parsing local storage data:', error);
                dataOutputDiv.innerHTML = '<p>Could not parse data from local storage. Try syncing again.</p>';
            }
        } else {
            statusDiv.textContent = 'No data found in local storage. Click "Sync Data Now" to fetch it.';
            dataOutputDiv.innerHTML = '<p>No data has been synced yet, or no data was found in local storage on page load.</p>';
        }
    }

    // Event listener for the sync button
    syncButton.addEventListener('click', () => {
        statusDiv.textContent = 'Fetching data from spreadsheet...';
        dataOutputDiv.innerHTML = '<p><em>Processing your request...</em></p>';
        syncButton.disabled = true; // Disable button during sync

        fetch(spreadsheetUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(csvText => {
                statusDiv.textContent = 'CSV data fetched. Saving raw CSV to local storage...';
                localStorage.setItem(rawCsvStorageKey, csvText);
                console.log("Raw CSV data saved to local storage.");

                statusDiv.textContent = 'Converting CSV to JS format...';
                const jsonData = convertCsvToJs(csvText);

                if (jsonData.length === 0 && csvText.trim() !== "" ) {
                     console.warn("Conversion resulted in empty JS data, but raw CSV was not empty. CSV content:", csvText);
                     statusDiv.textContent = 'Warning: Conversion resulted in empty JS data. Check CSV format or content.';
                } else {
                    statusDiv.textContent = 'Conversion successful. Saving JS data to local storage...';
                }
                
                localStorage.setItem(jsonDataStorageKey, JSON.stringify(jsonData));
                console.log("Structured JS data saved to local storage:", jsonData);

                statusDiv.textContent = `Data synced and saved! Displaying ${jsonData.length} records.`;
                displayDataAsTable(jsonData);
            })
            .catch(error => {
                statusDiv.textContent = `Error during sync: ${error.message}`;
                dataOutputDiv.innerHTML = `<p>Failed to fetch or process data. Please check the console (F12) for more details. Error: ${error.message}</p>`;
                console.error('Sync process failed:', error);
            })
            .finally(() => {
                syncButton.disabled = false; // Re-enable button
            });
    });

    // Initial load from local storage when the page loads
    loadAndDisplayFromLocalStorage();
});
