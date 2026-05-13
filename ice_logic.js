// Approximate global mean surface temperature anomalies (°C) relative to 1850-1900
// pre-industrial baseline, derived from HadCRUT5.
const GLOBAL_TEMP_ANOMALY = {
    1850: -0.08, 1860: -0.09, 1870: -0.07, 1880: -0.02, 1890: -0.06,
    1900: -0.05, 1910: -0.12, 1920: -0.05, 1930: 0.03,  1940: 0.08,
    1950: 0.01,  1960: -0.01, 1970: 0.01,  1980: 0.16,  1990: 0.30,  2000: 0.42
};

function tempColor(diffC) {
    const raw = parseFloat(diffC);
    if (!(raw > 0)) return '#22c55e'; // green — cooler, no change, or NaN/unknown
    if (raw < 0.18) return '#eab308'; // yellow — small warming
    if (raw < 0.36) return '#f97316'; // orange — moderate warming
    return '#ef4444';                 // red — large warming
}

// Global variables
let currentYear = 1850;
let currentData = null;
let width = 1200;
let height = 800;
let colorScale = null;
let baselineData = null;
let baselineYear = 1850;
let maxYear = 1850;
let baseMean = 0, baseMax = 0, baseMin = 0, baseIceCoverage = 0;
let baseValues = [], baseTotalCells = 0;

// Load 1850 data
async function loadBaselineData(year) {
    try {
        const baseResponse = await fetch(`./data/sea_ice_${year}.json`);
        if (!baseResponse.ok) {
            throw new Error(`HTTP error! status: ${baseResponse.status}`);
        }
        baselineData = await baseResponse.json();
        const baseThickData = baselineData.data;

        for (let i = 0; i < baseThickData.length; i++) {
            for (let j = 0; j < baseThickData[i].length; j++) {
                const val = baseThickData[i][j];
                if (val !== null && !isNaN(val) && val > 0) {
                    baseValues.push(val);
                }
            }
        }

        if (baseValues.length > 0) {
            baseMean = baseValues.reduce((a, b) => a + b, 0) / baseValues.length;
            baseMax = Math.max(...baseValues);
            baseMin = Math.min(...baseValues);
            baseTotalCells = baseThickData.length * baseThickData[0].length;
            baseIceCoverage = (baseValues.length / baseTotalCells * 100).toFixed(1);
        }
    } catch (error) {
        console.error(`Error loading baseline data:`, error);
    }
}


// Initialize all viz elements when the page loads
document.addEventListener('DOMContentLoaded', async function () {
    await loadBaselineData(baselineYear);
    setupIceCanvas();
    setupYearSlider();
    loadRememberedYear();
    setupCompareSlider();
    setupEasterEgg();
});

function setupEasterEgg() {
    const body = document.querySelector('body');
    body.addEventListener('click', (event) => {
        if (event.target === document.body) {
            if (body.style.backgroundImage.includes('rick-roll-rick-ashley.gif')) {
                body.style.backgroundImage = '';
            } else {
                body.style.backgroundImage = "url('./assets/rick-roll-rick-ashley.gif')"
            }
        }
    });
}

function setupIceCanvas() {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'iceCanvas';
    canvas.width = width;
    canvas.height = height;
    canvas.style.cursor = 'crosshair';
    canvas.style.border = '1px solid #ddd';
    canvas.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

    const vizDiv = document.getElementById('visualization');
    if (vizDiv) {
        vizDiv.innerHTML = '';
        vizDiv.appendChild(canvas);
    }

    // Add hover event listener
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => {
        const tooltip = document.querySelector(".tooltip");
        tooltip.style.visibility = 'hidden';
        console.log("hiding tooltip");

        const pointStatsDiv = document.getElementById('point-stats');
        if (pointStatsDiv) {
            pointStatsDiv.innerHTML = `
                📍 <strong>Location:</strong> No Data | 
                <strong>Ice Thickness:</strong> N/A <br>
                <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
            `;
        }
    });

    // Create color scale
    colorScale = d3.scaleSequentialLog()
        .domain([0.01, 5])
        .interpolator(d3.interpolateBlues);

    // Create colorbar
    createColorbar();
}

function setupYearSlider() {
    const slider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('yearValue');
    const compareSlider = document.getElementById('compareSlider');
    const compareDisplay = document.getElementById('compareValue');

    // Update as you drag
    slider.addEventListener('input', async (event) => {
        const year = parseInt(event.target.value);
        yearDisplay.textContent = year;
        localStorage.setItem('selectedYear', year);

        maxYear = year;
        await clampCompareSlider();
        loadYear(year); // Update map and stats (uses now-correct baseline)
    });

    slider.setAttribute('list', 'decades');

    const datalist = document.createElement('datalist');
    datalist.id = 'decades';

    const years = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920,
        1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000];

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.label = year;
        datalist.appendChild(option);
    });

    document.body.appendChild(datalist);
}

function setupCompareSlider() {
    const compareSlider = document.getElementById('compareSlider');
    const compareDisplay = document.getElementById('compareValue');

    compareSlider.addEventListener('input', async (event) => {
        let compareYear = parseInt(event.target.value);
        // Clamp the value to not exceed the year slider's value
        if (compareYear > maxYear) {
            compareYear = maxYear;
            compareSlider.value = maxYear;
        }

        compareDisplay.textContent = compareYear;
        localStorage.setItem('compareYear', compareYear);
        baselineYear = compareYear;
        baseValues = [];
        baseTotalCells = 0;
        await loadBaselineData(compareYear);
        if (currentData) {
            updateOverallStats(currentData);
            updateVisualization(currentData)
        }
    });

    compareSlider.setAttribute('list', 'compareDecades');

    const compareDatalist = document.createElement('datalist');
    compareDatalist.id = 'compareDecades';

    const years = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920,
        1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000];

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        compareDatalist.appendChild(option);
    });

    document.body.appendChild(compareDatalist);
}

async function loadYear(year) {
    // Show loading state
    const overallStatsDiv = document.getElementById('overall-stats');
    if (overallStatsDiv) {
        overallStatsDiv.innerHTML = '📡 Loading sea ice data for ' + year + '...';
    }

    try {
        // Fetch the JSON file for this specific year
        const response = await fetch(`./data/sea_ice_${year}.json`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const yearData = await response.json();
        // Update global variable with currently used dataset
        currentData = yearData;

        // Update the visualization
        updateVisualization(yearData);

        // Update statistics
        updateOverallStats(yearData);

    } catch (error) {
        console.error(`Error loading data for ${year}:`, error);
        if (overallStatsDiv) {
            overallStatsDiv.innerHTML = `❌ Error loading data for ${year}. Make sure sea_ice_${year}.json exists.`;
        }

        // Show error on canvas
        const canvas = document.getElementById('iceCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#ff0000';
            ctx.font = '16px Arial';
            ctx.fillText(`Failed to load data for ${year}`, width / 2 - 150, height / 2);
        }
    }
}

async function clampCompareSlider() {
    const compareSlider = document.getElementById('compareSlider');
    if (!compareSlider) return;
    const compareDisplay = document.getElementById('compareValue');

    let compareYear = parseInt(compareSlider.value);
    if (compareYear > maxYear) {
        compareSlider.value = maxYear;
        compareDisplay.textContent = maxYear;
        localStorage.setItem('compareYear', maxYear);
        baselineYear = maxYear;
        baseValues = [];
        baseTotalCells = 0;
        await loadBaselineData(maxYear);
    }
}

// Sliders will remember their years between refreshes, so load it in to make all other elements match!
async function loadRememberedYear() {
    const slider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('yearValue');
    const compareSlider = document.getElementById('compareSlider');
    const compareDisplay = document.getElementById('compareValue');

    // Restore saved values from localStorage, fall back to slider defaults
    const savedYear = localStorage.getItem('selectedYear');
    const savedCompareYear = localStorage.getItem('compareYear');

    if (savedYear) {
        slider.value = savedYear;
        maxYear = savedYear;
    }
    if (savedCompareYear) {
        compareSlider.value = savedCompareYear;
        baselineYear = parseInt(savedCompareYear);
        baseValues = [];
        baseTotalCells = 0;
        await loadBaselineData(baselineYear);
    }

    loadYear(savedYear);
    clampCompareSlider();
}

function updateVisualization(data) {
    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const thicknessData = data.data;

    if (!thicknessData || thicknessData.length === 0) return;

    const nx = thicknessData[0].length;
    const ny = thicknessData.length;
    const cellWidth = width / nx;
    const cellHeight = height / ny;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Draw baseline year in gray
    if (baselineData) {
        const baseThickData = baselineData.data;
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                let flipped_x = nx - i - 1;
                let flipped_y = ny - j - 1;
                const baseValue = baseThickData[flipped_y][flipped_x];

                if (baseValue !== null && !isNaN(baseValue) && baseValue > 0) {
                    ctx.fillStyle = '#c2c0c0';  // gray for baseline ice
                } else {
                    ctx.fillStyle = '#e0e0e0';  // light gray for land/no ice
                }
                ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
            }
        }
    }

    // Draw selected year on top with transparency ---
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
            let flipped_x = nx - i - 1;
            let flipped_y = ny - j - 1;
            const value = thicknessData[flipped_y][flipped_x];

            if (value !== null && !isNaN(value) && value > 0) {
                let color;
                if (value <= 0.1) color = 'rgba(240,248,255,0.85)';
                else if (value <= 0.5) color = 'rgba(198,219,239,0.85)';
                else if (value <= 1.0) color = 'rgba(158,202,225,0.85)';
                else if (value <= 1.5) color = 'rgba(107,174,214,0.85)';
                else if (value <= 2.0) color = 'rgba(66,146,198,0.85)';
                else if (value <= 3.0) color = 'rgba(33,113,181,0.85)';
                else color = 'rgba(8,69,148,0.85)';

                ctx.fillStyle = color;
                ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);

                ctx.strokeStyle = '#2c5f8a';
                ctx.lineWidth = 0.1;
                ctx.strokeRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
            }
            // If no ice in selected year, leave the gray baseline visible underneath
        }
    }
    updateDisplay();

    // Draw mini color bar at bottom right
    const miniBarWidth = 140;
    const miniBarHeight = 12;
    const miniBarX = width - miniBarWidth - 10;
    const miniBarY = height - 25;

    // Define the color segments for mini bar
    const segments = [
        { color: '#f0f8ff', width: miniBarWidth / 7 },  // 0-0.1m
        { color: '#c6dbef', width: miniBarWidth / 7 },  // 0.1-0.5m
        { color: '#9ecae1', width: miniBarWidth / 7 },  // 0.5-1.0m
        { color: '#6baed6', width: miniBarWidth / 7 },  // 1.0-1.5m
        { color: '#4292c6', width: miniBarWidth / 7 },  // 1.5-2.0m
        { color: '#2171b5', width: miniBarWidth / 7 },  // 2.0-3.0m
        { color: '#084594', width: miniBarWidth / 7 }   // 3.0+m
    ];

    for (let i = 0; i < segments.length; i++) {
        ctx.fillStyle = segments[i].color;
        ctx.fillRect(miniBarX + (i * segments[i].width), miniBarY, segments[i].width, miniBarHeight);
    }

    // Border around mini color bar
    ctx.strokeStyle = '#999';
    ctx.strokeRect(miniBarX, miniBarY, miniBarWidth, miniBarHeight);

    // Labels for mini color bar
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.fillText('Thinner', miniBarX, miniBarY - 2);
    ctx.fillText('Thicker', miniBarX + miniBarWidth - 30, miniBarY - 2);
}

function handleMouseMove(event) {
    if (!currentData) return;

    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const thicknessData = currentData.data;
    if (!thicknessData) return;

    const nx = thicknessData[0].length;
    const ny = thicknessData.length;

    const i = Math.floor(mouseX / width * nx);
    const j = Math.floor(mouseY / height * ny);

    if (i >= 0 && i < nx && j >= 0 && j < ny) {
        let flipped_x = nx - i - 1;
        let flipped_y = ny - j - 1;
        const iceDepth = thicknessData[flipped_y][flipped_x];
        const baseDepth = baselineData ? baselineData.data[flipped_y][flipped_x] : null;
        const lat = currentData.lat?.[flipped_y]?.[flipped_x] ?? null;
        const lon = currentData.lon?.[flipped_y]?.[flipped_x] ?? null;

        updateToolTip(event, iceDepth, baseDepth);
        updatePointStats(lat, lon, iceDepth);
    }
}

function updateToolTip(event, iceDepth, baseDepth) {
    // Create a tooltip-like display right under the cursor
    const tooltipX = event.pageX - 16;
    const tooltipY = event.pageY - 16;

    // Create tooltip if one doesn't exist yet
    let tooltip = document.querySelector(".tooltip");
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.classList.add("tooltip");
        // Put at the front so that its coordinates are relative to the screen rather than whatever container it's in
        document.body.prepend(tooltip);
    }
    const currentHasIce = iceDepth !== null && !isNaN(iceDepth) && iceDepth > 0;
    const baseHasIce = baseDepth !== null && !isNaN(baseDepth) && baseDepth > 0;

    // Only show tooltip if at least one year has ice
    if (currentHasIce || baseHasIce) {
        let tooltipContent;

        if (currentData.year === baselineYear) {
            // Same year selected — only show one line
            tooltipContent = currentHasIce
                ? `❄️ ${currentData.year}: ${iceDepth.toFixed(3)} ${currentData.units || 'm'}`
                : `🌊 ${currentData.year}: No ice`;
        } else {
            // Different years — show both
            const currentLine = currentHasIce
                ? `❄️ ${currentData.year}: ${iceDepth.toFixed(3)} ${currentData.units || 'm'}`
                : `🌊 ${currentData.year}: No ice`;
            const baseLine = baseHasIce
                ? `❄️ ${baselineYear}: ${baseDepth.toFixed(3)} ${baselineData.units || 'm'}`
                : `🌊 ${baselineYear}: No ice`;
            tooltipContent = `${currentLine}<br>${baseLine}`;
        }
        tooltip.innerHTML = tooltipContent;
        tooltip.style.visibility = 'visible';
    } else {
        tooltip.innerHTML = `🏔️Land/No Ice`
        tooltip.style.visibility = 'visible';
    }

    tooltip.style.left = tooltipX + 16 + 'px';
    tooltip.style.top = tooltipY + 16 + 'px';
}

function updateDisplay() {
    const canvas = document.getElementById('iceCanvas');
    const ctx = canvas.getContext('2d');
    const data = currentData;

    // Title
    ctx.font = 'bold 20px Arial';
    const yearDifference = data.year - baselineYear;
    const yearDisplay = yearDifference != 0 ? `${data.year} vs. ${baselineYear}` : `${data.year}`
    const text = `Sea Ice Thickness (m) - ${yearDisplay}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'white';
    ctx.strokeText(text, 10, 30);
    ctx.fillStyle = '#2c3e50';
    ctx.fillText(text, 10, 30);

    // Mini color bar
    const miniBarWidth = 140;
    const miniBarHeight = 12;
    const miniBarX = width - miniBarWidth - 10;
    const miniBarY = height - 25;
    const segments = [
        { color: '#f0f8ff' }, { color: '#c6dbef' }, { color: '#9ecae1' },
        { color: '#6baed6' }, { color: '#4292c6' }, { color: '#2171b5' },
        { color: '#084594' }
    ];
    for (let i = 0; i < segments.length; i++) {
        ctx.fillStyle = segments[i].color;
        ctx.fillRect(miniBarX + (i * miniBarWidth / 7), miniBarY, miniBarWidth / 7, miniBarHeight);
    }
    ctx.strokeStyle = '#999';
    ctx.strokeRect(miniBarX, miniBarY, miniBarWidth, miniBarHeight);
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.fillText('Thinner', miniBarX, miniBarY - 2);
    ctx.fillText('Thicker', miniBarX + miniBarWidth - 30, miniBarY - 2);

    // Pole labels
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    const poleLabels = [
        { label: 'Arctic',    x: 10, y: 52 },
        { label: 'Antarctic', x: 10, y: height - 10 },
    ];
    for (const { label, x, y } of poleLabels) {
        const measured = ctx.measureText(label);
        const padX = 6, padH = 18;
        const boxW = measured.width + padX * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.beginPath();
        ctx.roundRect(x - padX, y - 13, boxW, padH, 4);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(label, x, y);
    }
}

function updatePointStats(lat, lon, iceDepth) {
    const pointStatsDiv = document.getElementById('point-stats');
    if (!pointStatsDiv) return;

    const locStr = (lat !== null && lon !== null)
        ? `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
        : 'N/A';
    const thickStr = (iceDepth !== null && !isNaN(iceDepth) && iceDepth > 0)
        ? `${iceDepth.toFixed(3)} ${currentData.units || 'm'}`
        : '0.000 m';

    pointStatsDiv.innerHTML = `
        📍 <strong>Location:</strong> ${locStr} |
        <strong>Ice Thickness:</strong> ${thickStr}<br>
        <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
    `;
}

function createColorbar() {
    const colorbarDiv = document.getElementById('colorbar');
    if (!colorbarDiv) return;

    colorbarDiv.innerHTML = '';

    const svg = d3.select("#colorbar")
        .append("svg")
        .attr("width", 400)
        .attr("height", 70)
        .style("display", "block")
        .style("margin", "0 auto");

    // Create gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "iceGradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    // Add color stops
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#f0f8ff");
    gradient.append("stop").attr("offset", "20%").attr("stop-color", "#c6dbef");
    gradient.append("stop").attr("offset", "40%").attr("stop-color", "#9ecae1");
    gradient.append("stop").attr("offset", "60%").attr("stop-color", "#6baed6");
    gradient.append("stop").attr("offset", "80%").attr("stop-color", "#2171b5");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#084594");

    // Draw colorbar rectangle
    svg.append("rect")
        .attr("width", 300)
        .attr("height", 20)
        .attr("x", 50)
        .attr("y", 10)
        .style("fill", "url(#iceGradient)")
        .style("stroke", "#ddd")
        .style("stroke-width", "1px");

    // Add labels
    svg.append("text")
        .attr("x", 50)
        .attr("y", 45)
        .text("0 m")
        .style("font-size", "12px")
        .style("text-anchor", "middle");

    svg.append("text")
        .attr("x", 200)
        .attr("y", 45)
        .text("1 m")
        .style("font-size", "12px")
        .style("text-anchor", "middle");

    svg.append("text")
        .attr("x", 350)
        .attr("y", 45)
        .text("3+ m")
        .style("font-size", "12px")
        .style("text-anchor", "middle");

    svg.append("text")
        .attr("x", 200)
        .attr("y", 65)
        .text("Sea Ice Thickness →")
        .style("font-size", "11px")
        .style("text-anchor", "middle")
        .style("fill", "#666");
}

function updatePointStats(i, j, iceDepth) {
    // Update point stats at bottom of the document with data of cell being hovered over
    const pointStatsDiv = document.getElementById('point-stats');
    if (!pointStatsDiv) return;

    if (iceDepth !== null && !isNaN(iceDepth) && iceDepth > 0) {
        pointStatsDiv.innerHTML = `
            📍 <strong>Location:</strong> (${i}, ${j}) | 
            <strong>Ice Thickness:</strong> ${iceDepth.toFixed(3)} ${currentData.units || 'm'}<br>
            <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
        `;
    } else {
        pointStatsDiv.innerHTML = `
            📍 <strong>Location:</strong> (${i}, ${j}) | 
            <strong>Ice Thickness:</strong> 0.000 m <br>
            <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
        `;
    }
}

// Update stats for that year at the bottom of the page
function updateOverallStats(data) {
    const thicknessData = data.data;
    const overallStatsDiv = document.getElementById('overall-stats');

    if (!overallStatsDiv || !thicknessData) return;

    // Flatten the array and filter valid values
    const values = [];
    for (let i = 0; i < thicknessData.length; i++) {
        for (let j = 0; j < thicknessData[i].length; j++) {
            const val = thicknessData[i][j];
            if (val !== null && !isNaN(val) && val > 0) {
                values.push(val);
            }
        }
    }

    if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        // Calculate ice coverage percentage
        const totalCells = thicknessData.length * thicknessData[0].length;
        const iceCoverage = (values.length / totalCells * 100).toFixed(1);

        const tempSelected = GLOBAL_TEMP_ANOMALY[data.year] ?? 0;
        const tempVs1850 = (tempSelected - (GLOBAL_TEMP_ANOMALY[1850] ?? 0)).toFixed(2);
        const tempVs1850Direction = tempVs1850 > 0 ? 'warmer' : 'cooler';
        overallStatsDiv.innerHTML = `
            <strong>📊 Overall Statistics for ${data.year}:</strong><br>
            Mean ice thickness: ${mean.toFixed(3)} ${data.units || 'm'} |
            Max: ${max.toFixed(3)} ${data.units || 'm'}<br>
            Ice-covered area fraction: ${iceCoverage}%<br>
            Global avg. temperature: <span style="color:${tempColor(tempVs1850)};font-weight:bold;">${Math.abs(tempVs1850)}°C ${tempVs1850Direction}</span> vs. 1850 baseline
        `;
        const comparedStatsDiv = document.getElementById('compared-stats');
        if (comparedStatsDiv && baselineData) {
            const coverageDiff = ((iceCoverage - baseIceCoverage) / baseIceCoverage * 100).toFixed(1);
            const coverageDirection = coverageDiff > 0 ? 'increase' : 'decrease';

            const tempBase = GLOBAL_TEMP_ANOMALY[baselineYear] ?? 0;
            const tempCurrent = GLOBAL_TEMP_ANOMALY[data.year] ?? 0;
            const tempDiff = (tempCurrent - tempBase).toFixed(2);
            const tempDirection = tempDiff > 0 ? 'warmer' : 'cooler';
            comparedStatsDiv.innerHTML = `
                <strong>📊 ${data.year} statistics vs. ${baselineYear} baseline:</strong><br>
                Mean ice thickness difference: ${(mean - baseMean).toFixed(3)} ${baselineData.units || 'm'} |
                Max difference: ${(max - baseMax).toFixed(3)} ${baselineData.units || 'm'}<br>
                Ice-covered area difference: ${Math.abs(coverageDiff)}% ${coverageDirection} in ice-coverage from ${baselineYear} → ${data.year}<br>
                Global avg. temperature: <span style="color:${tempColor(tempDiff)};font-weight:bold;">${Math.abs(tempDiff)}°C ${tempDirection}</span> in ${data.year} than ${baselineYear}
            `;
        } else {
            overallStatsDiv.innerHTML = `📊 No sea ice detected in ${data.year}`;
        }
    }
}
