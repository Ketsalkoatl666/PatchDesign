import * as THREE from 'https://cdn.jsdelivr.net/npm/three/build/three.module.js';
//import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from './OBJExporter.js';

const canvas = document.getElementById('myCanvas');
const context = canvas.getContext('2d');
let isDrawing = false;
let currentBoundary = []; // Stores the current drawing path
let finalizedBoundaries = []; // Stores all finalized boundaries
let backgroundImage = new Image();
const circleDistributionX = [];
const circleDistributionZ = [];
// Load background image
document.getElementById('backgroundImage').addEventListener('change', (event) => {
    const file = event.target.files[0]; // Get the first file
    if (file && (file.type == "image/jpeg" || file.type == "image/png")) {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log("Image loaded:", e.target.result); // Log the result
            backgroundImage.src = e.target.result;
            backgroundImage.onload = drawBackground; // Redraw when image is loaded
        };
        reader.onerror = function() {
            console.error("Error reading file:", reader.error); // Log any errors
        };
        reader.readAsDataURL(file); // Read the file as a data URL
    } else {
        console.error("Unsupported file type.");
    }
});
// Mouse events for drawing
canvas.addEventListener('mousedown', (e) => {
    // Start a new drawing if not currently finalizing
    isDrawing = true;
    currentBoundary.push({ x: e.offsetX, y: e.offsetY });
});

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        currentBoundary.push({ x: e.offsetX, y: e.offsetY });
        drawAllBoundaries(); // Draw all boundaries including the current one
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    if (currentBoundary.length > 0) {
        finalizedBoundaries.push([...currentBoundary]); // Store the completed boundary
        currentBoundary = []; // Reset for the next drawing
        drawAllBoundaries(); // Refresh the canvas
    }
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

// Function to draw the background image
function drawBackground() {
    // Clear the canvas
    //context.clearRect(0, 0, canvas.width, canvas.height);
    // Draw the background image
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
}

// Function to draw all finalized boundaries and the current drawing
function drawAllBoundaries() {

    // Draw all finalized boundaries
    finalizedBoundaries.forEach(path => {
        context.beginPath();
        path.forEach((point, index) => {
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        });
        context.closePath();
        context.strokeStyle = 'black'; // Finalized boundaries in black
        context.lineWidth = 2;
        context.stroke();
    });

    // Draw the current boundary being created
    if (currentBoundary.length > 0) {
        context.beginPath();
        currentBoundary.forEach((point, index) => {
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        });
        context.strokeStyle = 'red'; // Current drawing in red
        context.lineWidth = 2;
        context.stroke();
    }
    //console.log(currentBoundary[0].x);
    return finalizedBoundaries;
}

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

// create 3D

document.getElementById('generate3DModelBtn').addEventListener('click', () => {
    create3DModel();
});

// Calculate circle distribution based on the finalized boundaries
function calculateCircleDistribution(radius) {
    const circles = [];
    const spacing = radius * 2;

    for (let y = spacing; y < canvas.height; y += spacing) {
        for (let x = spacing; x < canvas.width; x += spacing) {
            if (isInsideAnyBoundary(x, y)) {
                circles.push({ x: x, y: y });
            }
        }
    }
    return circles;
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
    circles.forEach(circle => {
        context.beginPath();
        context.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
        context.fillStyle = 'blue';
        context.fill();
        context.stroke();
        circleDistributionX.push(circle.x);
        circleDistributionZ.push(circle.y);
    });
    return circleDistributionX, circleDistributionZ;
    
}
// ----------------- Generating 3D models -------------------//
function create3DModel() {

    // Create scene
    const scene = new THREE.Scene();

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 500;

    // Create renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add ambient light
    const light = new THREE.AmbientLight(0xffffff);
    scene.add(light);
    
    // Function to create a cup from a circle
    function createCup(radius, height) {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, radius, 0, Math.PI * 2, false); // Create a circle shape

        const extrudeSettings = {
            depth: height,
            bevelEnabled: false,
        };

        const cupGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const cupMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const cup = new THREE.Mesh(cupGeometry, cupMaterial);

        return cup;
    }

    // Generate multiple cups
    const numCups = circleDistributionX.length;
    const cupHeight = 2;

    for (let i = 0; i < numCups; i++) {
        const diameter = parseFloat(document.getElementById('diameter').value);
        const radius =  diameter / 2;; // Increase radius for each cup
        const cup = createCup(radius, cupHeight);
        //cup.position.x = i * 3; // Position cups apart
        cup.position.x = Number(circleDistributionX[i]);
        cup.position.y = Number(circleDistributionZ[i]);
        // Rotate the cube 90 degrees around the Y-axis
        //cup.rotation.x = Math.PI / 2; // 90 degrees in radians
        scene.add(cup);
    }


// --------Create a shape from the drawing boundary--------//
    // Create an array to hold Three.js Vector3 points
    const pointsArray = [];
    // Convert each (x, y) pair into a Vector3 point
    for(let i = 0; i < finalizedBoundaries.length; i++){
        finalizedBoundaries[i].forEach(point => {
            const vector = new THREE.Vector3(point.x, point.y, 0); // Set z to 0 for 2D
            pointsArray.push(vector);
            console.log(finalizedBoundaries);
        });
    
    }

    console.log(pointsArray);
    const shape = new THREE.Shape(pointsArray);

    // Define the extrude settings
    const extrudeSettings = {
        depth: 1 , // Thickness of the geometry
        bevelEnabled: true, // Disable bevel for sharp edges
    };
    // Create the geometry by extruding the shape
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Create a material
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    // Create a mesh from the geometry and material
    const mesh = new THREE.Mesh(geometry, material);
    //mesh.position.set (5,0);
    console.log('Scene before adding model:', scene);
    //mesh.scale.set(2,2);
    scene.add(mesh);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Function to export the model as OBJ
    function exportModel() {
        const exporter = new OBJExporter();
        const result = exporter.parse(scene); // Export scene to OBJ format
        const blob = new Blob([result], { type: 'text/plain' }); // Create a blob from the result
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); // Create a download link
        link.download = 'model.obj'; // Specify the file name
        link.click(); // Trigger the download
    }

    // Add a button to trigger the export
    const exportButton = document.createElement('button');
    exportButton.innerText = 'Download Model';
    exportButton.onclick = exportModel;
    document.body.appendChild(exportButton);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}



//------ clean functions ------//

// Clear only drawings (boundaries and circles) but keep the background image
document.getElementById('clearDrawingsBtn').addEventListener('click', () => {
    currentBoundary = [];
    finalizedBoundaries = [];
    //circles = [];
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    drawBackground();
    //drawAllBoundaries(); // Redraw to keep the background
});
// Clear canvas functionality
document.getElementById('clearBtn').addEventListener('click', () => {
    currentBoundary = []; // Reset the current drawing path
    finalizedBoundaries = []; // Reset finalized boundaries
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
});