import * as THREE from 'three';
//import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from './OBJExporter.js';
import { OrbitControls } from 'OrbitControls';
//import { CSG } from 'three-csg-ts';

const canvas = document.getElementById('myCanvas');
const context = canvas.getContext('2d');
let isDrawing = false;
let currentBoundary = []; // Stores the current drawing path
let finalizedBoundaries = []; // Stores all finalized boundaries
let backgroundImage = new Image();
const circleDistributionX = [];
const circleDistributionZ = [];

let isEditMode = false;
let draggedPoint = null; // Keeps track of which specific point we grabbed
const dragRadius = 10; // How close the mouse needs to be to grab a point

// Load background image
document.getElementById('backgroundImage').addEventListener('change', (event) => {
    const file = event.target.files[0]; // Get the first file
    if (file && (file.type == "image/jpeg" || file.type == "image/png")) {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log("Image loaded:", e.target.result); // Log the result
            backgroundImage.src = e.target.result;
            backgroundImage.onload = drawBackground; // Redraw when image is loaded
            document.getElementById('canvas-text').style.display = 'none';
        };
        reader.onerror = function() {
            console.error("Error reading file:", reader.error); // Log any errors
        };
        reader.readAsDataURL(file); // Read the file as a data URL
    } else {
        console.error("Unsupported file type.");
    }
});

// ------------Mouse events for drawing -------------//
canvas.addEventListener('mousedown', (e) => {
if (isEditMode) {
        // Look for a point near the mouse click
        for (let i = 0; i < finalizedBoundaries.length; i++) {
            for (let j = 0; j < finalizedBoundaries[i].length; j++) {
                let pt = finalizedBoundaries[i][j];
                let dx = e.offsetX - pt.x;
                let dy = e.offsetY - pt.y;
                // If we clicked within the drag radius, grab this point!
                if (dx * dx + dy * dy <= dragRadius * dragRadius) {
                    draggedPoint = pt;
                    return; // Stop searching once we found one
                }
            }
        }
    } else {
        // Standard drawing logic
        isDrawing = true;
        currentBoundary.push({ x: e.offsetX, y: e.offsetY });
    }
});

canvas.addEventListener('mousemove', (e) => {
if (isEditMode && draggedPoint) {
        // If we are holding a point, move its coordinates to the mouse
        draggedPoint.x = e.offsetX;
        draggedPoint.y = e.offsetY;
        drawAllBoundaries(); // Redraw immediately to see it move
    } else if (isDrawing) {
        currentBoundary.push({ x: e.offsetX, y: e.offsetY });
        drawAllBoundaries(); 
    }
});

canvas.addEventListener('mouseup', () => {
    if (isEditMode) {
        // Let go of the point
        draggedPoint = null; 
    } else {
        isDrawing = false;
        if (currentBoundary.length > 0) {
            
            // --- NEW CODE: Filter the points! ---
            // The '3' is the tolerance in pixels. 
            // Increase it (e.g., to 5) for fewer points, decrease it (e.g., to 1) for more points.
            const simplifiedBoundary = simplifyPath(currentBoundary, 3);
            
            finalizedBoundaries.push([...simplifiedBoundary]); 
            currentBoundary = []; 
            drawAllBoundaries(); 
        }
    }
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
    draggedPoint = null;
});

// Function to draw the background image
function drawBackground() {
    //Clear the canvas
    //context.clearRect(0, 0, canvas.width, canvas.height);
    //Draw the background image
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
}

// Function to draw all finalized boundaries and the current drawing
function drawAllBoundaries() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundImage.src) {
        drawBackground();
    }

    // Draw all finalized boundaries in black (AND CLOSE THEM)
    finalizedBoundaries.forEach(path => {
        drawSmoothPath(path, '#475569', true); 
    });

    // Draw the current boundary being created in red (DO NOT CLOSE YET)
    if (currentBoundary.length > 0) {
        drawSmoothPath(currentBoundary, '#61dafb', false); 
    }
    if (isEditMode) {
        finalizedBoundaries.forEach(path => {
            path.forEach(point => {
                context.beginPath();
                context.arc(point.x, point.y, 4, 0, Math.PI * 2);
                context.fillStyle = '#ffffff';
                context.fill();
                context.strokeStyle = '#0056b3';
                context.lineWidth = 1;
                context.stroke();
            });
        });
    }
}

// Helper function to draw a path with smooth curves
function drawSmoothPath(path, color, isClosed = false) {
    if (path.length < 2) return; 

    context.beginPath();
    context.moveTo(path[0].x, path[0].y);

    // Draw smooth quadratic curves through the midpoints
    for (let i = 1; i < path.length - 1; i++) {
        const midX = (path[i].x + path[i + 1].x) / 2;
        const midY = (path[i].y + path[i + 1].y) / 2;
        context.quadraticCurveTo(path[i].x, path[i].y, midX, midY);
    }

    // Draw a line to the very last point
    const lastPoint = path[path.length - 1];
    context.lineTo(lastPoint.x, lastPoint.y);

    // NEW CODE: If the shape is finalized, draw a line back to the start
    if (isClosed) {
        context.closePath(); 
    }

    // Apply styling and stroke to the canvas
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
}    

// Calculates the perpendicular distance from a point to a line segment
function pointLineDistance(point, start, end) {
    if (start.x === end.x && start.y === end.y) {
        return Math.sqrt(Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2));
    }
    const numerator = Math.abs((end.y - start.y) * point.x - (end.x - start.x) * point.y + end.x * start.y - end.y * start.x);
    const denominator = Math.sqrt(Math.pow(end.y - start.y, 2) + Math.pow(end.x - start.x, 2));
    return numerator / denominator;
}

// The filtering algorithm that removes redundant points
function simplifyPath(points, tolerance) {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const d = pointLineDistance(points[i], start, end);
        if (d > maxDistance) {
            maxDistance = d;
            index = i;
        }
    }

    if (maxDistance > tolerance) {
        const left = simplifyPath(points.slice(0, index + 1), tolerance);
        const right = simplifyPath(points.slice(index), tolerance);
        return left.slice(0, left.length - 1).concat(right);
    } else {
        return [start, end];
    }
}

//-----------Buttons--------------//

document.getElementById('editModeBtn').addEventListener('click', (e) => {
    isEditMode = !isEditMode;
    e.target.innerText = isEditMode ? 'Back to Draw Mode' : 'Enter Edit Mode';
    e.target.style.backgroundColor = isEditMode ? '#ff9800' : '#61dafb'; // Optional color change
    drawAllBoundaries(); 
});

// Calculate and draw circles based on user-defined boundaries
document.getElementById('calculateBtn').addEventListener('click', () => {
    const diameter = parseFloat(document.getElementById('diameter').value);
    if (!isNaN(diameter) && diameter > 0 && finalizedBoundaries.length > 0) {
        const radius = diameter / 2;
        const circles = calculateCircleDistribution(radius);
        drawAllBoundaries(); // Redraw all finalized boundaries
        drawCircles(circles, radius);
    } else {
        alert('Please enter a valid diameter and finalize a boundary.');
    }
});

// --- UPDATE SLIDER UI ---
document.getElementById('diameter').addEventListener('input', (e) => {
    // Updates the number text next to the slider
    document.getElementById('diameterValue').innerText = e.target.value;
});

// Calculate circle distribution with a staggered pattern and boundary padding
function calculateCircleDistribution(radius) {
    const circles = [];
    const diameter = radius * 2;
    
    // --- SPACING CONTROLS ---
    // 1.5 means the distance between cup centers is 1.5x the diameter (leaves a 0.5x diameter gap)
    const gapMultiplier = 1.5; 
    const stepX = diameter * gapMultiplier;
    
    // Calculates the exact mathematical height needed for interlocking staggered rows
    const stepY = stepX * (Math.sqrt(3) / 2); 
    
    // The required distance from the wall (user requested 1 full diameter)
    const margin = diameter; 

    let row = 0;
    // Loop through the canvas using our new vertical step
    for (let y = 0; y < canvas.height; y += stepY) {
        // If it is an odd row, shift all cups to the right by half a step to create the stagger
        const offsetX = (row % 2 === 0) ? 0 : stepX / 2;
        
        for (let x = offsetX; x < canvas.width; x += stepX) {
            // Check if this location is safely inside the padding limits
            if (isSafelyInside(x, y, margin)) {
                circles.push({ x: x, y: y });
            }
        }
        row++;
    }
    return circles;
}

// Helper function to ensure a coordinate is a specific distance away from the boundary walls
function isSafelyInside(x, y, margin) {
    // 1. First, check if the exact center point is inside. If not, fail immediately.
    if (!isInsideAnyBoundary(x, y)) return false;

    // 2. Check 8 points around the center at the 'margin' distance.
    const angles = [
        0, Math.PI/4, Math.PI/2, Math.PI*0.75, 
        Math.PI, Math.PI*1.25, Math.PI*1.5, Math.PI*1.75
    ];
    
    for (let angle of angles) {
        const testX = x + Math.cos(angle) * margin;
        const testY = y + Math.sin(angle) * margin;
        
        // If any of these outer radar points fall outside the boundary, it is too close to the edge.
        if (!isInsideAnyBoundary(testX, testY)) {
            return false; 
        }
    }
    
    return true; // All checks passed, it is safe to place a cup here
}
// Check if a point is inside any of the finalized boundaries
function isInsideAnyBoundary(x, y) {
    for (let path of finalizedBoundaries) {
        context.beginPath();
        path.forEach((point, index) => {
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        });
        context.closePath();
        if (context.isPointInPath(x, y)) {
            return true; // Inside one of the finalized boundaries
        }
    }
    return false; // Not inside any finalized boundary
}

// Function to draw the circles
function drawCircles(circles, radius) {
    // NEW CODE: Clear the arrays so cups don't duplicate on multiple clicks
    circleDistributionX.length = 0;
    circleDistributionZ.length = 0;

    circles.forEach(circle => {
        context.beginPath();
        context.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
        context.fillStyle = 'blue';
        context.fill();
        context.stroke();
        circleDistributionX.push(circle.x);
        circleDistributionZ.push(circle.y);
    });
}
// // ----------------- Generating 3D models -------------------//
// function create3DModel() {

//     // Create scene
//     const scene = new THREE.Scene();

//     // Create camera
//     const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//     camera.position.z = 500;

//     // Create renderer
//     const renderer = new THREE.WebGLRenderer();
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     document.body.appendChild(renderer.domElement);

//     // Add ambient light
//     const light = new THREE.AmbientLight(0xffffff);
//     scene.add(light);
    
//     // Function to create a cup from a circle
//     function createCup(radius, height) {
//         const shape = new THREE.Shape();
//         shape.absarc(0, 0, radius, 0, Math.PI * 2, false); // Create a circle shape

//         const extrudeSettings = {
//             depth: height,
//             bevelEnabled: false,
//         };

//         const cupGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
//         const cupMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
//         const cup = new THREE.Mesh(cupGeometry, cupMaterial);

//         return cup;
//     }

//     // Generate multiple cups
//     const numCups = circleDistributionX.length;
//     const cupHeight = 2;

//     for (let i = 0; i < numCups; i++) {
//         const diameter = parseFloat(document.getElementById('diameter').value);
//         const radius =  diameter / 2;; // Increase radius for each cup
//         const cup = createCup(radius, cupHeight);
//         //cup.position.x = i * 3; // Position cups apart
//         cup.position.x = Number(circleDistributionX[i]);
//         cup.position.y = Number(circleDistributionZ[i]);
//         // Rotate the cube 90 degrees around the Y-axis
//         //cup.rotation.x = Math.PI / 2; // 90 degrees in radians
//         scene.add(cup);
//     }

// // --------Create a shape from the drawing boundary--------//
    
//     // Loop through each finalized boundary individually to prevent geometric glitches
//     finalizedBoundaries.forEach(boundary => {
//         if (boundary.length < 3) return; // Need at least a triangle to extrude a shape

//         const pointsArray = [];
        
//         // 1. Convert to Vector2 (Three.js prefers Vector2 for 2D Shapes)
//         boundary.forEach(point => {
//             pointsArray.push(new THREE.Vector2(point.x, point.y));
//         });

//         // 2. Create a mathematically smooth spline curve from your filtered points
//         const splineCurve = new THREE.SplineCurve(pointsArray);

//         // 3. Extract a high-density array of points from that curve
//         // The '50' dictates the resolution. Higher = smoother edges!
//         const smoothPoints = splineCurve.getPoints(50);

//         // 4. Create the shape using the newly smoothed points
//         const shape = new THREE.Shape(smoothPoints);

//         // Define the extrude settings
//         const extrudeSettings = {
//             depth: 2, // Thickness of the patch
//             bevelEnabled: true, // Bevels make CAD models look much more realistic
//             bevelThickness: 0.5,
//             bevelSize: 0.5,
//             bevelSegments: 3
//         };

//         // Create the geometry and material
//         const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
//         const material = new THREE.MeshStandardMaterial({ 
//             color: 0x00ff00,
//             roughness: 0.4, // Makes the surface look a bit more like physical material
//             metalness: 0.1
//         });

//         // Create the mesh and add it to the scene
//         const mesh = new THREE.Mesh(geometry, material);
//         scene.add(mesh);
//     });
//     // Animation loop
//     function animate() {
//         requestAnimationFrame(animate);
//         renderer.render(scene, camera);
//     }
//     animate();

//     // Function to export the model as OBJ
//     function exportModel() {
//         const exporter = new OBJExporter();
//         const result = exporter.parse(scene); // Export scene to OBJ format
//         const blob = new Blob([result], { type: 'text/plain' }); // Create a blob from the result
//         const link = document.createElement('a');
//         link.href = URL.createObjectURL(blob); // Create a download link
//         link.download = 'model.obj'; // Specify the file name
//         link.click(); // Trigger the download
//     }

//     // Add a button to trigger the export
//     const exportButton = document.createElement('button');
//     exportButton.innerText = 'Download Model';
//     exportButton.onclick = exportModel;
//     document.body.appendChild(exportButton);

//     // Handle window resize
//     window.addEventListener('resize', () => {
//         camera.aspect = window.innerWidth / window.innerHeight;
//         camera.updateProjectionMatrix();
//         renderer.setSize(window.innerWidth, window.innerHeight);
//     });
// }

// ----------------- Generating 3D models -------------------//
// --- 8. 3D GENERATION (FAST OVERLAP METHOD) ---
document.getElementById('generate3DModelBtn').addEventListener('click', () => {
    create3DModel();
});

function create3DModel() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e0e0); 
    const threeCanvasElement = document.getElementById('threeCanvas');
    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvasElement, antialias: true });
    renderer.setSize(600, 400); 
    const camera = new THREE.PerspectiveCamera(75, 600 / 400, 0.1, 1000);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, -100, 200);
    scene.add(directionalLight);
    
    // Create a Group to hold all the separate pieces together
    const modelGroup = new THREE.Group();
    
    const patchMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x61dafb, 
        roughness: 0.2,      // Smoother surface
        metalness: 0.0,      // Plastics/silicones have no metalness
        transparent: true, 
        opacity: 0.7, 
        transmission: 0.6,   // Creates a glass-like refraction effect
        thickness: 1.5       // Simulates the physical depth of the gel
    });

    // --- 1. GENERATE THE BASE(S) ---
    finalizedBoundaries.forEach(boundary => {
        if (boundary.length < 3) return; 
        const pointsArray = boundary.map(p => new THREE.Vector2(p.x, p.y));
        const splineCurve = new THREE.SplineCurve(pointsArray);
        const shape = new THREE.Shape(splineCurve.getPoints(50));

        // Base is 2 units thick
        const extrudeSettings = { depth: 2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        const baseMesh = new THREE.Mesh(geometry, patchMaterial);
        modelGroup.add(baseMesh); 
    });

    if (modelGroup.children.length === 0) {
        alert("Please draw a boundary first!");
        return;
    }

    // --- 2. GENERATE THE CUPS (INSTANTLY) ---
    if (circleDistributionX.length > 0) {
        const diameter = parseFloat(document.getElementById('diameter').value);
        const radius = diameter / 2;
        const cupHeight = 4; 
        const wallThickness = 1; 
        const innerRadius = radius - wallThickness;

        if (innerRadius > 0) {
            
            // OPTIMIZATION: Create a 2D "Donut" shape natively in Three.js
            const donutShape = new THREE.Shape();
            donutShape.absarc(0, 0, radius, 0, Math.PI * 2, false); // Outer wall
            
            const holePath = new THREE.Path();
            holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true); // Inner hole (true = draw backwards to subtract)
            donutShape.holes.push(holePath);

            // Extrude the hollow donut into a pipe
            const pipeGeo = new THREE.ExtrudeGeometry(donutShape, { depth: cupHeight, bevelEnabled: false });

            // Instantly stamp out the cups
            for (let i = 0; i < circleDistributionX.length; i++) {
                const cupMesh = new THREE.Mesh(pipeGeo, patchMaterial);
                
                // Position the X and Y (Z in 3D). 
                // Set the vertical height to Z=2 so it sits perfectly on top of the 2-unit thick base
                cupMesh.position.set(Number(circleDistributionX[i]), Number(circleDistributionZ[i]), 2); 
                
                modelGroup.add(cupMesh);
            }
        } else {
            console.warn("Cups too small to hollow out. Generating base only.");
        }
    }

    // Add everything to the scene
    scene.add(modelGroup);

    // --- 3. AUTO-CENTER CAMERA & ADD CONTROLS ---
    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const cameraDistance = size.length() > 0 ? size.length() * 0.8 : 500;
    camera.position.set(center.x, center.y, cameraDistance);
    camera.lookAt(center);

    const ControlsClass = typeof OrbitControls !== 'undefined' ? OrbitControls : THREE.OrbitControls;
    const controls = new ControlsClass(camera, renderer.domElement);
    controls.target.copy(center);
    controls.update();

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // --- 4. EXPORT ---
    function exportModel() {
        const exporter = new OBJExporter();
        const result = exporter.parse(scene); // Exports all overlapping shapes in the scene
        const blob = new Blob([result], { type: 'text/plain' }); 
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); 
        link.download = 'fast_patch.obj'; 
        link.click(); 
    }

    const oldButton = document.getElementById('exportButtonObj');
    if (oldButton) oldButton.remove();

    const exportButton = document.createElement('button');
    exportButton.id = 'exportButtonObj';
    exportButton.innerText = 'Download Model';
    exportButton.style.marginTop = '20px';
    exportButton.onclick = exportModel;
    document.getElementById('threeCanvas').parentElement.appendChild(exportButton);
}
//------ clean functions ------//

// Clear canvas functionality
document.getElementById('clearBtn').addEventListener('click', () => {
    currentBoundary = []; // Reset the current drawing path
    finalizedBoundaries = []; // Reset finalized boundaries
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
});