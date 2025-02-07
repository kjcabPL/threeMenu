import * as THREE from 'three';
import gsap from 'gsap';
import { MenuItem } from './MenuItem.js';

// private variables
let keyPressed = false; // keypress event is deprecated
let leftEdge, rightEdge;
let firstNode, latestNode, nodeToSelect = null;
let nextNodeID = 0;
const itemGroup = new THREE.Group();
console.log("Creating itemGroup: ", itemGroup);

export function Menu(_scene = null, _camera = null, _properties = null) {
 
  // menu parts
  this.scene = _scene;
  this.camera = _camera;
  this.itemTray = [];
  this.itemTrayAction = [];
  this.itemSelected = 0;
  this.menuRotate = true;
  this.enabled = true;
  this.opened = false;

  // Initialize then reload
  this.init(_properties);
  this.reload();
}

// Class constants
Menu.OPEN_NOTRANSITION = 0;
Menu.OPEN_GROW = 1;
Menu.OPEN_TRANSPARENCY = 2;

/**
 * Initialize menu properties
 */
Menu.prototype.init = function(_properties) {

  // camera & scene factors
  nextNodeID = 0;
  nodeToSelect = null;
  leftEdge = rightEdge = null;
  this.defaultSpeed = 0.1;
  this.cameraDistance = 1;

  // item positioning and behavior factors
  this.gapBetweenItems = {
    x: 1,
    y: 0,
    z: 0
  }
  this.selectBehavior = "grow" // For now only Grow behavior is available. Make "shine" behavior available too
  this.resizeScale = 0.5;
  this.resizeSpeed = 2;
  this.closeTime = 0.5;
  this.openTime = 0.5;
  this.shuffleSpeed = 2;
  this.revolvingMenu = true;

  this.openBehavior = (_properties && _properties.openBehavior && typeof _properties.openBehavior === "number") ? _properties.openBehavior : this.OPEN_GROW;

  // keys for keydown events. Use strings as needed
  this.prevKey = 'ArrowLeft';
  this.nextKey = 'ArrowRight';
  this.selectKey = 'Enter';
}

/**
 * Add new items to the menu class
 * @param {*} mesh 
 */
Menu.prototype.add = function (mesh, _doOnSelect = null) {
  const item = new MenuItem(mesh, {
    rotationSpeed: this.defaultSpeed
  });

  const node = new MenuNode(item, _doOnSelect, this.itemTray.length, nextNodeID);
  
  // assign the previous and next nodes if the itemTray is still empty, and default it as the first selected node
  if (nextNodeID == 0) {
    firstNode = node;
    latestNode = node;
    node.selected = true;
    nodeToSelect = node;
  }

  // setup the node relationships
  node.prev = latestNode;
  node.next = firstNode;
  node.prev.next = node;
  node.next.prev = node;
  latestNode = node;
  nextNodeID++;
  item.item.position.set(0,0,0);

  // setup opening behavior based on this.openBehavior setting
  switch (this.openBehavior) {
    case this.OPEN_GROW: 
      node.properties["scale"] = {
        x: node.node.item.scale.x,
        y: node.node.item.scale.y,
        z: node.node.item.scale.z
      }
      node.node.item.scale.set({x: 0, y: 0, z: 0});
    break;
  }

  // Add the objects into the scene then reposition into rotational setup
  this.itemTray.push(node);
  this.itemTrayAction.push(_doOnSelect);
  itemGroup.add(mesh);
  this.repositionNodes();
}

Menu.prototype.repositionNodes = function() {
  let pos = {
    x: 0 - this.gapBetweenItems.x, 
    y: 0 - this.gapBetweenItems.y, 
    z: 0 - this.gapBetweenItems.z 
  };
  let median;
  
  // determine if the total is odd or even, then decide which node should be moved to the other side after reaching the median
  const total = nextNodeID;
  const isEven = (total % 2 == 0);
  let medianFactor = 0;
  median = Math.floor(total / 2);

  let current = firstNode;
  do {
    pos = {
      x: pos.x + this.gapBetweenItems.x,
      y: pos.y + this.gapBetweenItems.y,
      z: pos.z + this.gapBetweenItems.z
    }
    current.node.item.position.set(pos.x, pos.y, pos.z);
    pos.x = current.node.item.position.x;
    pos.y = current.node.item.position.y;
    pos.z = current.node.item.position.z;
    // median only works for 3 or more entries 
    if ((nextNodeID === 2 && current.id === 1) || (current.id === median + 1)) leftEdge = current;
    if (current.id === median) {
      // add a medianFactor for odd-valued entries to compensate for the extra gap between items
      medianFactor = isEven ? 0 : 1;
      pos.x = - (current.node.item.position.x + (this.gapBetweenItems.x * medianFactor));
      pos.y = - (current.node.item.position.y + (this.gapBetweenItems.y * medianFactor));
      pos.z = - (current.node.item.position.z + (this.gapBetweenItems.z * medianFactor));
      rightEdge = current;
    }
    current = current.next;
  } while (current.id != firstNode.id);

  return pos;
}

/**
 * Reload all Menu behaviors if properties are updated
 */
Menu.prototype.reload = function () {
  if (this.itemTray.length > 0) {
    this.itemTray.forEach(element => {
      element.node.rotationSpeed = this.defaultSpeed;
    });
  }
  
  if (this.scene) {
    this.scene.add(itemGroup);    
  }

  if (this.camera) this.camera.position.set(0, 0, this.cameraDistance);
  this.registerEvents();
}

/**
 * Animate every item in the menu tray. Requires elapsedTime to work
 * @param {*} elapsedTime 
 */
Menu.prototype.animate = function (elapsedTime) {
  if (!elapsedTime) return;

  let startingNode = firstNode, currentNode = startingNode;
  do {
    const item = currentNode.node;
    if (currentNode.selected) item.animateSelected(elapsedTime);
    else item.animateDefault(elapsedTime);
    currentNode = currentNode.next;
    

  } while (currentNode.id != startingNode.id);
}

/**
 * Menu Behaviors on keypresses
 */
Menu.prototype.moveToNext = function () {
  // unless rotate to previous has been added, block this action for now
  if (!this.opened || nextNodeID <= 1 || !this.revolvingMenu && this.itemSelected >= this.itemTray.length - 1) return keyPressed = false;
  
  let startingNode = firstNode, currentNode = startingNode;
  do {
    const item = currentNode.node;
    // transfer the leftmost node to the rightmost node
    if (currentNode == leftEdge) {      
      leftEdge.node.item.position.set(
        leftEdge.prev.node.item.position.x + this.gapBetweenItems.x, 
        leftEdge.prev.node.item.position.y + this.gapBetweenItems.y,
        leftEdge.prev.node.item.position.z + this.gapBetweenItems.z
      );
      rightEdge = leftEdge;
    }
    gsap.to(item.item.position, { 
      x: item.item.position.x - this.gapBetweenItems.x, 
      y: item.item.position.y - this.gapBetweenItems.y, 
      z: item.item.position.z - this.gapBetweenItems.z, 
      duration: this.shuffleSpeed * 0.10,
      onComplete: ()=> {
        keyPressed = false 
      } 
    });
    if (currentNode.selected) {
      nodeToSelect = currentNode.next;
      currentNode.selected = false;
    }
    currentNode = currentNode.next;
  } while (currentNode.id != firstNode.id);
  leftEdge = leftEdge.next;

  nodeToSelect.selected = true;
  this.itemSelected = nodeToSelect.id;
}

Menu.prototype.moveToPrev = function () {
  // unless rotate to previous has been added, block this action when exceeding the first entry
  if (!this.opened || nextNodeID <= 1 || !this.revolvingMenu && this.itemSelected <= 0) return keyPressed = false;

  let startingNode = firstNode, currentNode = startingNode;
  do {
    const item = currentNode.node;
    // transfer the rightmost node to the leftmost node
    if (currentNode == rightEdge) {      
      rightEdge.node.item.position.set(
        rightEdge.next.node.item.position.x - this.gapBetweenItems.x, 
        rightEdge.next.node.item.position.y - this.gapBetweenItems.y,
        rightEdge.next.node.item.position.z - this.gapBetweenItems.z
      );
      leftEdge = rightEdge;
    }
    gsap.to(item.item.position, { 
      x: item.item.position.x + this.gapBetweenItems.x,
      y: item.item.position.y + this.gapBetweenItems.y,
      z: item.item.position.z + this.gapBetweenItems.z,
      duration: this.shuffleSpeed * 0.10, 
      onComplete: ()=> { 
        keyPressed = false;
      } 
    });

    if (currentNode.selected) {
      nodeToSelect = currentNode.prev;
      currentNode.selected = false;
    }
    currentNode = currentNode.prev;
  } while (currentNode.id != firstNode.id);
  rightEdge = rightEdge.prev;

  nodeToSelect.selected = true;
  this.itemSelected = nodeToSelect.id;
}

Menu.prototype.selectItem = function () {
  if (!this.opened || !this.enabled) return keyPressed = false;

  const item = nodeToSelect.node;
  const action = nodeToSelect.action;

  // grow the item when clicked
  gsap.fromTo(
    item.item.scale, 
    { x: item.item.scale.x, y: item.item.scale.y, z: item.item.scale.z }, 
    { x: item.item.scale.x + this.resizeScale, y: item.item.scale.y + this.resizeScale, z: item.item.scale.z + this.resizeScale, 
      duration: this.resizeSpeed * 0.10, yoyo: true, repeat: 1,
      onComplete: () => {
        keyPressed = false;
        if (typeof action === "function") action();
      }
     }
  );
}

/**
 * Behaviors for opening, closing or translations
 */
Menu.prototype.open = function(_callback = null) {
  if (this.opened) return;
  let currentNode = firstNode;

  switch(this.openBehavior) {
    case this.OPEN_GROW:
      do {
        const item = currentNode.node;
        gsap.to(
          item.item.scale,
          { x: currentNode.properties.scale.x, y: currentNode.properties.scale.y, z: currentNode.properties.scale.z, duration: this.openTime }
        );
        currentNode = currentNode.next;
      } while (currentNode.id != firstNode.id);
      break;
  }
  
  this.opened = this.enabled = true;
  if (typeof _callback === "function") _callback();
}

Menu.prototype.close = function(_callback = null) {
  if (!this.opened) return;
  let currentNode = firstNode;
  do {
    const item = currentNode.node;
    gsap.to(
      item.item.scale,
      { x: 0, y: 0, z: 0, duration: this.closeTime }
    );
    currentNode = currentNode.next;
  } while (currentNode.id != firstNode.id);
  this.opened = this.enabled = false;
  if (typeof _callback === "function") _callback();
}

// Translate the menu's position, rotation & scaling based on parameters passed
Menu.prototype.moveMenu = function(parms = null) {
  if (!this.opened || !parms) return;
  
  const moveDur = (parms.duration && typeof parms.duration === "number") ? parms.duration : 0.5;

  const moveX = (parms.x && typeof parms.x === "number") ? parms.x : 0;
  const moveY = (parms.y && typeof parms.y === "number") ? parms.y : 0;
  const moveZ = (parms.z && typeof parms.z === "number") ? parms.z : 0;  
  
  const rotateX = (parms.rotateX && typeof parms.rotateX === "number") ? parms.rotateX : 0;
  const rotateY = (parms.rotateY && typeof parms.rotateY === "number") ? parms.rotateY : 0;
  const rotateZ = (parms.rotateZ && typeof parms.rotateZ === "number") ? parms.rotateZ : 0;
  
  const scaleTo = (parms.scale && typeof parms.scale === "number") ? parms.scale : null;
  const scaleToX = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleX : 1;
  const scaleToY = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleY : 1;
  const scaleToZ = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleZ : 1;
  const scale = {
    x: parms.scale ? scaleTo : scaleToX,
    y: parms.scale ? scaleTo : scaleToY,
    z: parms.scale ? scaleTo : scaleToZ,
    duration: moveDur
  }

  gsap.to(itemGroup.position, { x: moveX, y: moveY, z: moveZ, duration: moveDur });
  gsap.to(itemGroup.rotation, { x: rotateX, y: rotateY, z: rotateZ, duration: moveDur});
  gsap.to(itemGroup.scale, scale);
}

Menu.prototype.resetMenu = function () {
  this.moveMenu({});
}

// Key events to do actions
Menu.prototype.registerEvents = function () {
  window.addEventListener("keydown", (evt) => {
    if (keyPressed || !this.enabled) return;
    keyPressed = true;
    switch(evt.key) {
      case this.prevKey:
        this.moveToPrev();
        break;
      case this.nextKey:
        this.moveToNext();
        break;
      case this.selectKey:
        this.selectItem();
        break;
      default:
        keyPressed = false;
        break;
    }
  });
}

/**
 * Linked List Class for adding items into menu nodes
 */

function MenuNode(_node, _action, _id) {
  this.id = _id;
  this.node = _node;
  this.selected = false;
  this.action = _action;
  this.next = null;
  this.prev = null;
  this.properties = {};
}