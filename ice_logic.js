// Global variables
let currentYear = 1850;
let currentData = null;
let width = 800;
let height = 500;
let colorScale = null;

// Initialize the visualization when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeVisualization();
    setupYearButtons();
    loadYear(1850); // Load initial year
});

function initializeVisualization() {
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
        const statsDiv = document.getElementById('stats');
        if (statsDiv) {
            statsDiv.innerHTML = 'Hover over the map to see ice thickness values';
        }
    });
    
    // Create color scale
    colorScale = d3.scaleSequentialLog()
        .domain([0.01, 5])
        .interpolator(d3.interpolateBlues);
    
    // Create colorbar
    createColorbar();
}

function setupYearButtons() {
    const years = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 
                   1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000];
    
    const panel = document.getElementById('yearButtons');
    if (!panel) return;
    
    panel.innerHTML = '';
    
    years.forEach(year => {
        const button = document.createElement('button');
        button.textContent = year;
        button.className = 'year-selector';
        if (year === currentYear) button.classList.add('active');
        button.addEventListener('click', () => {
            // Update active button style
            document.querySelectorAll('.year-selector').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Load the selected year
            currentYear = year;
            document.getElementById('yearDisplay').textContent = `Year: ${year}`;
            loadYear(year);
        });
        panel.appendChild(button);
    });
}

async function loadYear(year) {
    // Show loading state
    const statsDiv = document.getElementById('stats');
    if (statsDiv) {
        statsDiv.innerHTML = '📡 Loading sea ice data for ' + year + '...';
    }
    
    try {
        // Fetch the JSON file for this specific year
        const response = await fetch(`./data/sea_ice_${year}.json`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const yearData = await response.json();
        currentData = yearData;
        
        // Update the visualization
        updateVisualization(yearData);
        
        // Update statistics
        updateStats(yearData);
        
    } catch (error) {
        console.error(`Error loading data for ${year}:`, error);
        if (statsDiv) {
            statsDiv.innerHTML = `❌ Error loading data for ${year}. Make sure sea_ice_${year}.json exists.`;
        }
        
        // Show error on canvas
        const canvas = document.getElementById('iceCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#ff0000';
            ctx.font = '16px Arial';
            ctx.fillText(`Failed to load data for ${year}`, width/2 - 150, height/2);
        }
    }
}

function updateVisualization(data) {
    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const thicknessData = data.data;
    
    if (!thicknessData || thicknessData.length === 0) {
        console.error('No data available');
        return;
    }
    
    const ny = thicknessData.length;
    const nx = thicknessData[0].length;
    const cellWidth = width / nx;
    const cellHeight = height / ny;
    
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    // Draw each grid cell
    for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nx; j++) {
            const value = thicknessData[i][j];
            
            // Check for valid ice thickness (positive values)
            if (value !== null && !isNaN(value) && value > 0) {
                // Color based on ice thickness
                let color;
                if (value <= 0.1) {
                    color = '#f0f8ff';  // Very thin ice
                } else if (value <= 0.5) {
                    color = '#c6dbef';
                } else if (value <= 1.0) {
                    color = '#9ecae1';
                } else if (value <= 1.5) {
                    color = '#6baed6';
                } else if (value <= 2.0) {
                    color = '#4292c6';
                } else if (value <= 3.0) {
                    color = '#2171b5';
                } else {
                    color = '#084594';  // Very thick ice
                }
                
                ctx.fillStyle = color;
                ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
                
                // Add subtle border for grid lines
                ctx.strokeStyle = 'rgba(200,200,200,0.3)';
                ctx.strokeRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
            } else {
                // Land or no ice - light gray
                ctx.fillStyle = '#e0e0e0';
                ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
            }
        }
    }
    
    // Add title and annotations
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.shadowBlur = 0;
    ctx.fillText(`Sea Ice Thickness (${data.units || 'm'}) - ${data.year}`, 10, 30);
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('Grid resolution: ' + nx + ' x ' + ny, 10, 55);
    
    // Add color bar hint
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.fillText('← Thinner', width - 120, height - 15);
    ctx.fillText('Thicker →', width - 40, height - 15);
    
    // Draw a mini color gradient bar at the bottom
    const gradientWidth = 100;
    const gradientHeight = 10;
    const gradientX = width - gradientWidth - 10;
    const gradientY = height - 20;
    
    for (let i = 0; i < gradientWidth; i++) {
        const t = i / gradientWidth;
        let color;
        if (t < 0.2) color = '#f0f8ff';
        else if (t < 0.4) color = '#c6dbef';
        else if (t < 0.6) color = '#9ecae1';
        else if (t < 0.8) color = '#4292c6';
        else color = '#084594';
        
        ctx.fillStyle = color;
        ctx.fillRect(gradientX + i, gradientY, 1, gradientHeight);
    }
    ctx.strokeStyle = '#999';
    ctx.strokeRect(gradientX, gradientY, gradientWidth, gradientHeight);
}

function updateStats(data) {
    const thicknessData = data.data;
    const statsDiv = document.getElementById('stats');
    
    if (!statsDiv || !thicknessData) return;
    
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
        
        statsDiv.innerHTML = `
            <strong>📊 Statistics for ${data.year}:</strong><br>
            Mean ice thickness: ${mean.toFixed(3)} ${data.units || 'm'} | 
            Max: ${max.toFixed(3)} ${data.units || 'm'} | 
            Min: ${min.toFixed(3)} ${data.units || 'm'}<br>
            Ice-covered area fraction: ${iceCoverage}% (${values.length.toLocaleString()} of ${totalCells.toLocaleString()} cells)
        `;
    } else {
        statsDiv.innerHTML = `📊 No sea ice detected in ${data.year}`;
    }
}

function handleMouseMove(event) {
    if (!currentData) return;
    
    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    const thicknessData = currentData.data;
    if (!thicknessData) return;
    
    const ny = thicknessData.length;
    const nx = thicknessData[0].length;
    
    const i = Math.floor(mouseY / height * ny);
    const j = Math.floor(mouseX / width * nx);
    
    const statsDiv = document.getElementById('stats');
    if (!statsDiv) return;
    
    if (i >= 0 && i < ny && j >= 0 && j < nx) {
        const value = thicknessData[i][j];
        if (value !== null && !isNaN(value) && value > 0) {
            statsDiv.innerHTML = `
                📍 <strong>Location:</strong> (${j}, ${i}) | 
                <strong>Ice Thickness:</strong> ${value.toFixed(3)} ${currentData.units || 'm'}<br>
                <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
            `;
        } else {
            statsDiv.innerHTML = `
                📍 <strong>Location:</strong> (${j}, ${i}) | 
                <strong>Status:</strong> No ice or land<br>
                <span style="font-size: 12px; color: #666;">Hover over map for values | Click year buttons to change time</span>
            `;
        }
    }
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