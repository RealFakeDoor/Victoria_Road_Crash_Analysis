let map; // Declare map variable in a higher scope
let markers; // Declare markers variable in a higher scope

document.getElementById('plotButton').addEventListener('click', async () => {
    const year = document.getElementById('yearSelect').value;
    const field = document.getElementById('fieldSelect').value;
    const chartType = document.querySelector('input[name="chartType"]:checked').value;

    if (['NO_PERSONS', 'NO_PERSONS_INJ_2', 'NO_PERSONS_INJ_3', 'NO_PERSONS_KILLED', 'NO_PERSONS_NOT_INJ'].includes(field)) {
        const data = await loadAndSumData(year);
        console.log('Summed data to plot:', data); // Log summed data to plot for debugging

        if (data && Object.keys(data).length > 0) {
            plotSummedData(data, chartType);
        } else {
            console.warn('No data available for the selected criteria.');
            document.getElementById('plot').innerHTML = '<p>No data available for the selected criteria.</p>';
        }
    } else {
        const data = await loadDataAndPlot(year, field);
        console.log('Data to plot:', data); // Log data to plot for debugging

        if (data && data.length > 0) {
            plotData(data, field, chartType);
        } else {
            console.warn('No data available for the selected criteria.');
            document.getElementById('plot').innerHTML = '<p>No data available for the selected criteria.</p>';
        }
    }
});

document.getElementById('plotButtonMap').addEventListener('click', async () => {
    const year = document.getElementById('yearSelectMap').value;
    const dbPath = 'Data/RoadCrashesVic.sqlite';

    try {
        const response = await fetch(dbPath);
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/sql-wasm.wasm` });
        const db = new SQL.Database(new Uint8Array(buffer));

        const query = `
            SELECT 
                N.LATITUDE,
                N.LONGITUDE,
                A.ACCIDENT_DATE,
                A.ACCIDENT_TIME,
                A.ACCIDENT_TYPE_DESC
            FROM 
                ACCIDENT A
                JOIN NODE N ON A.ACCIDENT_NO = N.ACCIDENT_NO
            WHERE 
                strftime('%Y', A.ACCIDENT_DATE) = ?;
        `;

        const stmt = db.prepare(query);
        stmt.bind([year]);

        let result = [];
        while (stmt.step()) {
            result.push(stmt.getAsObject());
        }

        stmt.free();

        if (result.length > 0) {
            plotMap(result);
        } else {
            console.warn('No data available for the selected criteria.');
            document.getElementById('map').innerHTML = '<p>No data available for the selected criteria.</p>';
        }
    } catch (error) {
        console.error('Error loading or querying database:', error);
    }
});

function plotMap(data) {
    // Initialize the map if it doesn't exist
    if (!map) {
        map = L.map('map').setView([-37.8136, 144.9631], 10); // Center map on Melbourne
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    }

    // Clear existing markers
    if (markers) {
        markers.clearLayers();
    } else {
        markers = L.markerClusterGroup();
        map.addLayer(markers);
    }

    // Add new markers
    data.forEach(accident => {
        if (accident.LATITUDE && accident.LONGITUDE) {
            const marker = L.marker([accident.LATITUDE, accident.LONGITUDE]);
            marker.bindPopup(`
                <b>Date:</b> ${accident.ACCIDENT_DATE}<br>
                <b>Time:</b> ${accident.ACCIDENT_TIME}<br>
                <b>Type:</b> ${accident.ACCIDENT_TYPE_DESC}
            `);
            markers.addLayer(marker);
        }
    });
}

async function loadAndSumData(year) {
    const dbPath = 'Data/RoadCrashesVic.sqlite';
    const response = await fetch(dbPath);
    const buffer = await response.arrayBuffer();
    const SQL = await initSqlJs({ locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/sql-wasm.wasm` });
    const db = new SQL.Database(new Uint8Array(buffer));

    const query = `
        SELECT 
            NO_PERSONS, 
            NO_PERSONS_INJ_2, 
            NO_PERSONS_INJ_3, 
            NO_PERSONS_KILLED, 
            NO_PERSONS_NOT_INJ
        FROM 
            ACCIDENT 
        WHERE 
            strftime('%Y', ACCIDENT_DATE) = ?;
    `;

    const stmt = db.prepare(query);
    stmt.bind([year]);

    let result = [];
    while (stmt.step()) {
        result.push(stmt.getAsObject());
    }

    stmt.free();

    if (result.length > 0) {
        const summedData = result.reduce((acc, curr) => {
            Object.keys(curr).forEach(key => {
                acc[key] = (acc[key] || 0) + curr[key];
            });
            return acc;
        }, {});

        return summedData;
    } else {
        return null;
    }
}

function plotSummedData(data, chartType) {
    const fieldNames = {
        NO_PERSONS: 'Total Persons',
        NO_PERSONS_INJ_2: 'Injuries Level 2',
        NO_PERSONS_INJ_3: 'Injuries Level 3',
        NO_PERSONS_KILLED: 'Persons Killed',
        NO_PERSONS_NOT_INJ: 'Persons Not Injured'
    };

    const xValues = Object.keys(data).map(key => fieldNames[key]);
    const yValues = Object.values(data);

    let plotData;
    if (chartType === 'bar') {
        plotData = [{
            x: xValues,
            y: yValues,
            type: 'bar',
            text: yValues,
            textposition: 'auto',
        }];
    } else if (chartType === 'pie') {
        plotData = [{
            labels: xValues,
            values: yValues,
            type: 'pie',
            text: yValues,
            textinfo: 'label+percent',
            hoverinfo: 'label+value',
        }];
    }

    const layout = {
        title: 'Crash Data Summary',
    };

    Plotly.newPlot('plot', plotData, layout);
}

async function loadDataAndPlot(year, field) {
    const dbPath = 'Data/RoadCrashesVic.sqlite';
    const response = await fetch(dbPath);
    const buffer = await response.arrayBuffer();
    const SQL = await initSqlJs({ locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/sql-wasm.wasm` });
    const db = new SQL.Database(new Uint8Array(buffer));

    const query = `
        SELECT 
            ${field}, 
            COUNT(*) as count 
        FROM 
            ACCIDENT 
        WHERE 
            strftime('%Y', ACCIDENT_DATE) = ? 
        GROUP BY 
            ${field};
    `;

    const stmt = db.prepare(query);
    stmt.bind([year]);

    let result = [];
    while (stmt.step()) {
        result.push(stmt.getAsObject());
    }

    stmt.free();

    return result;
}

function plotData(data, field, chartType) {
    const xValues = data.map(d => d[field]);
    const yValues = data.map(d => d.count);

    let plotData;
    if (chartType === 'bar') {
        plotData = [{
            x: xValues,
            y: yValues,
            type: 'bar',
            text: yValues,
            textposition: 'auto',
        }];
    } else if (chartType === 'pie') {
        plotData = [{
            labels: xValues,
            values: yValues,
            type: 'pie',
            textinfo: 'label+percent',
            hoverinfo: 'label+value',
        }];
    }

    const layout = {
        title: `Crash Data by ${field}`,
    };

    Plotly.newPlot('plot', plotData, layout);
}