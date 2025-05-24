document.addEventListener('DOMContentLoaded', () => {
    const syncButton = document.getElementById('syncButton');
    const statusMessage = document.getElementById('statusMessage');
    const jsonDataDisplay = document.getElementById('jsonDataDisplay');

    // Your Google Sheet public HTML URL
    const GOOGLE_SHEET_PUBHTML_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgcWwiuMgzw6tonNkr1ahkPOeJqBH1OcTSPQOC7lqVWUtue9CgksQQQn2MVmw89fWJ39c-helCid4v/pubhtml';
    const LOCAL_STORAGE_KEY = 'quizQuestionsData';

    // Function to display currently stored data
    function displayStoredData() {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);
                jsonDataDisplay.textContent = JSON.stringify(parsedData, null, 2); // Pretty print JSON
            } catch (e) {
                jsonDataDisplay.textContent = "Error parsing stored data.";
                console.error("Error parsing localStorage data:", e);
            }
        } else {
            jsonDataDisplay.textContent = "No data synced yet or cache is empty.";
        }
    }

    // Function to parse the HTML table from the fetched Google Sheet content
    function parseSheetHTML(htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // Google Sheets pubhtml often puts the main table inside a div like 'sheets-viewport'
        // Or it might be the first table. We need to inspect the actual structure.
        // For the provided URL, the data table is the first `<table>` within `div#sheets-viewport div`
        // More generally, it might be `doc.querySelector('table')` if it's simple.
        // Let's try a robust selector; if not found, we fall back.
        let table = doc.querySelector('div#sheets-viewport table'); // More specific based on typical structure
        if (!table) {
            // Fallback: Often the data is in the first main table
             const tables = doc.querySelectorAll('table');
             // Heuristic: find a table with a tbody and multiple rows
             for(let t of tables) {
                if (t.querySelector('tbody tr')) { // Check if it has rows in tbody
                    const headerCells = t.querySelectorAll('thead td, thead th, tbody tr:first-child td'); // Try to get headers
                    // Check if header cells look like your expected headers (e.g., "S.N", "Question")
                    if (headerCells.length > 3 && headerCells[0].textContent.trim().toUpperCase() === "S.N") {
                        table = t;
                        break;
                    }
                }
             }
             if (!table && tables.length > 0) table = tables[0]; // Last resort if other checks fail
        }


        if (!table) {
            throw new Error('Could not find the data table in the fetched HTML.');
        }

        const headers = [];
        const data = [];

        // Attempt to get headers from <thead> or the first row of <tbody>
        // The pubhtml often has headers in <tbody><tr><td>...</td></tr>
        const headerRow = table.querySelector('tbody tr'); // The first row in tbody often contains headers in pubhtml
        if (headerRow) {
            headerRow.querySelectorAll('td').forEach(cell => { // Headers are in <td> in this pubhtml format
                headers.push(cell.textContent.trim());
            });
        } else {
            throw new Error('Could not find header row in the table.');
        }

        if (headers.length === 0) {
            throw new Error('Headers are empty. Check table structure.');
        }
        
        // Get data rows (all rows in tbody except the first one, which we took as headers)
        const dataRows = Array.from(table.querySelectorAll('tbody tr')).slice(1); 

        dataRows.forEach(row => {
            const rowData = {};
            const cells = row.querySelectorAll('td');
            let isEmptyRow = true; // Flag to skip completely empty rows

            headers.forEach((header, index) => {
                const cellContent = cells[index] ? cells[index].textContent.trim() : '';
                rowData[header] = cellContent;
                if (cellContent !== '') {
                    isEmptyRow = false;
                }
            });
            if (!isEmptyRow) { // Only add if row has some content
                 data.push(rowData);
            }
        });
        return data;
    }


    // Event listener for the sync button
    syncButton.addEventListener('click', async () => {
        statusMessage.textContent = 'Syncing data...';
        statusMessage.className = ''; // Reset class
        syncButton.disabled = true;

        try {
            // Note: Fetching external HTML might be blocked by CORS if running from file://
            // It's best to run this from a local web server (e.g., Live Server in VS Code)
            // However, Google Sheets pubhtml links are generally permissive.
            const response = await fetch(GOOGLE_SHEET_PUBHTML_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const htmlText = await response.text();
            
            const jsonData = parseSheetHTML(htmlText);

            if (jsonData && jsonData.length > 0) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(jsonData));
                localStorage.setItem(LOCAL_STORAGE_KEY + '_timestamp', new Date().getTime());
                statusMessage.textContent = 'Data synced successfully and saved to local storage!';
                statusMessage.className = 'success';
                displayStoredData(); // Update the displayed JSON
            } else {
                throw new Error('No data extracted from the sheet or sheet is empty.');
            }

        } catch (error) {
            console.error('Error syncing data:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.className = 'error';
        } finally {
            syncButton.disabled = false;
        }
    });

    // Initial display of any stored data on page load
    displayStoredData();
});
