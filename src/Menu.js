import * as THREE from 'three';
import gsap from 'gsap';
import { MenuItem } from './MenuItem.js';

// private variables
let keyPressed = false, clicked = false, isMoving = false; // keypress event is deprecated
let leftEdge, rightEdge;
let firstNode, latestNode, nodeToSelect = null;
let nextNodeID = 0;
const rayCaster = new THREE.Raycaster();
const pt = new THREE.Vector2;

/**
 * Menu class initializer
 * @param {THREE.scale} _scene - Three.js Scene that will use the menu, 
 * @param {THREE.camera} _camera - Three.js Camera for the menu
 * @param {Object} [_properties] - Optional properties for the Menu class
 */
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
  this.itemGroup = new THREE.Group();
  this.itemCount = 0;

  // Initialize then reload
  this.init(_properties);
  this.reload();
}

// Class constants
Menu.prototype.OPEN_NOTRANSITION = 0;
Menu.prototype.OPEN_GROW = 1;
Menu.prototype.OPEN_TRANSPARENCY = 2;

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
  this.gapBetweenItems = { x: 1, y: 0, z: 0 };
  this.menuOffsetItems = { x: 0, y: 0, z: 0 };
  if (_properties && typeof _properties.gapBetweenItems === "object" )
  {
    this.gapBetweenItems.x = (typeof _properties.gapBetweenItems.x === "number" ) ? _properties.gapBetweenItems.x : this.gapBetweenItems.x;
    this.gapBetweenItems.y = (typeof _properties.gapBetweenItems.y === "number" ) ? _properties.gapBetweenItems.y : this.gapBetweenItems.y;
    this.gapBetweenItems.z = (typeof _properties.gapBetweenItems.z === "number" ) ? _properties.gapBetweenItems.z : this.gapBetweenItems.z;
  }
  if (_properties && typeof _properties.menuOffsetItems === "object" )
  {
    this.menuOffsetItems.x = (typeof _properties.menuOffsetItems.x === "number" ) ? _properties.menuOffsetItems.x : this.menuOffsetItems.x;
    this.menuOffsetItems.y = (typeof _properties.menuOffsetItems.y === "number" ) ? _properties.menuOffsetItems.y : this.menuOffsetItems.y;
    this.menuOffsetItems.z = (typeof _properties.menuOffsetItems.z === "number" ) ? _properties.menuOffsetItems.z : this.menuOffsetItems.z;
  }
  
  this.selectBehavior = "grow" // For now only Grow behavior is available. Make "shine" behavior available too
  this.resizeScale = (_properties && typeof _properties.resizeScale === "number") ? _properties.resizeScale : 0.5;
  this.resizeSpeed = (_properties && typeof _properties.resizeSpeed === "number") ? _properties.resizeSpeed : 2;
  this.closeTime =(_properties && typeof _properties.closeTime === "number") ? _properties.closeTime : 0.5;
  this.openTime = (_properties && typeof _properties.openTime === "number") ? _properties.openTime : 0.5;
  this.shuffleSpeed = (_properties && typeof _properties.shuffleSpeed === "number") ? _properties.shuffleSpeed : 2;  
  this.revolvingMenu = (_properties && _properties.revolvingMenu) ? _properties.revolvingMenu : true;
  this.openBehavior = (_properties && _properties.openBehavior && typeof _properties.openBehavior === "number") ? _properties.openBehavior : this.OPEN_NOTRANSITION;
  

  // keys for keydown events. Use strings as needed
  this.prevKey = 'ArrowLeft';
  this.nextKey = 'ArrowRight';
  this.selectKey = 'Enter';
}

/**
 * Add new items to the Menu object
 * @param {THREE.Mesh | THREE.Group} mesh - A Mesh or Group of meshes to represent the item
 * @param {function} _doOnSelect - Optional callback function for the item
 * @param {object} _properties - Optional properites for the item such as its default animation behavior
 */
Menu.prototype.add = function (mesh, _doOnSelect = null, _properties) {
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
  mesh.name = nextNodeID;

  // recurse through each group, mesh object and child in case the object passed is a group
  function assignTags(obj, id) {
    if (obj) obj.itemTag = nextNodeID;
    if (Object.hasOwn(obj, "children") && obj.children.length > 0) {
      for (let i = 0; i < obj.children.length; i++ ) {
        assignTags(obj.children[i], nextNodeID);
      }
    }
  }
  assignTags(mesh, nextNodeID);
  nextNodeID++;
  mesh.position.set(0,0,0);

  // save the properties of the added mesh for any opening/closing transition setting
  node.properties["scale"] = {
    x: node.node.item.scale.x,
    y: node.node.item.scale.y,
    z: node.node.item.scale.z
  }
  if (node.node.item.material && Object.hasOwn(node.node.item.material, "transparent")) {
    node.properties["transparent"] = node.node.item.material.transparent;
    node.properties["opacity"] = node.node.item.material.opacity;
  }

  // Add the objects into the scene then reposition into rotational setup  
  this.itemTray.push(node);
  this.itemTrayAction.push(_doOnSelect);
  this.itemGroup.add(mesh);
  this.itemCount++;
  this.repositionNodes();
}

Menu.prototype.repositionNodes = function() {

  // reset the itemGroup's position to original 0,0,0 in case new items are added every time
  this.itemGroup.position.set(0, 0 ,0);

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
      pos.x = - (current.node.item.position.x + ((this.gapBetweenItems.x ) * medianFactor)) ;
      pos.y = - (current.node.item.position.y + ((this.gapBetweenItems.y ) * medianFactor)) ;
      pos.z = - (current.node.item.position.z + ((this.gapBetweenItems.z ) * medianFactor)) ;
      rightEdge = current;
    }

    switch(this.openBehavior) {
      case this.OPEN_GROW: 
        current.node.item.scale.set({x: 0, y: 0, z: 0});
      break;
    }
    current = current.next;
  } while (current.id != firstNode.id);

  
  // apply the offset after calculating the positions
  this.itemGroup.position.x += this.menuOffsetItems.x;
  this.itemGroup.position.y += this.menuOffsetItems.y;
  this.itemGroup.position.z += this.menuOffsetItems.z;

  return pos;
}

/**
 * Reload all Menu behaviors if its properties are updated
 */
Menu.prototype.reload = function () {
  if (this.itemTray.length > 0) {
    this.itemTray.forEach(element => {
      element.node.rotationSpeed = this.defaultSpeed;
    });
  }
  
  if (this.scene) {
    this.scene.add(this.itemGroup);    
  }

  if (this.camera) this.camera.position.set(0, 0, this.cameraDistance);
  this.registerEvents();
}

/**
 * Animate every item in the menu tray. Requires elapsedTime to work
 * @param {*} elapsedTime - delta time for the animation
 */
Menu.prototype.animate = function (elapsedTime = null) {
  if (!elapsedTime) return;

  let startingNode = firstNode, currentNode = startingNode;
  do {
    if (!currentNode) break;
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
  if (!this.opened || nextNodeID <= 1 || isMoving || !this.revolvingMenu && this.itemSelected >= this.itemTray.length - 1) return keyPressed = false;
  
  let startingNode = firstNode, currentNode = startingNode;
  isMoving = true;
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
  isMoving = false;
}

Menu.prototype.moveToPrev = function () {
  // unless rotate to previous has been added, block this action when exceeding the first entry
  if (!this.opened || nextNodeID <= 1 || isMoving || !this.revolvingMenu && this.itemSelected <= 0) return keyPressed = false;

  let startingNode = firstNode, currentNode = startingNode;
  isMoving = true;
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
  isMoving = false;
}

Menu.prototype.selectItem = function () {
  if (!this.opened || !this.enabled) return keyPressed = false;

  const item = nodeToSelect.node;
  const action = nodeToSelect.action;

  // grow the item when clicked
  gsap.fromTo(
    item.item.scale, 
    { x: 1, y: 1, z: 1 }, 
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
    // resize on menu open
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
    // fade-in on menu open
    case this.OPEN_TRANSPARENCY:
      do {
        const item = currentNode.node;
        if (item.item.isGroup) {
          item.item.traverse((child) => {
            if (!child.isGroup) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  assignTransparency(mat, 0, 1, this.openTime, 100);
                });
              }
              else {
                assignTransparency(child.material, 0, 1, this.openTime, 100);
              }
            }
          });
        }
        else {
          if (Array.isArray(item.item.material)) {
            item.item.material.forEach((mat) => {
              assignTransparency(mat, 0, 1, this.openTime, 100);
            });
          }
          else {
            assignTransparency(item.item.material, 0, 1, this.openTime, 100);
          }
        }
        
        currentNode = currentNode.next;
      } while (currentNode.id != firstNode.id);
      break;

    function assignTransparency(material, opacityStart, opacityEnd, _duration, easeLevel = 100) {
      material.transparent = true;
      material.opacity = opacityStart,
      gsap.to(
        material,
        { "opacity": opacityEnd, duration: _duration, ease: "steps(" + easeLevel + ")" }
      );
    }
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

  const moveX = (parms.x && typeof parms.x === "number") ? parms.x + this.menuOffsetItems.x: 0 + this.menuOffsetItems.x;
  const moveY = (parms.y && typeof parms.y === "number") ? parms.y + this.menuOffsetItems.y: 0 + this.menuOffsetItems.y;
  const moveZ = (parms.z && typeof parms.z === "number") ? parms.z + this.menuOffsetItems.z: 0 + this.menuOffsetItems.z;
  
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
  };

  gsap.to(this.itemGroup.position, { x: moveX, y: moveY, z: moveZ, duration: moveDur });
  gsap.to(this.itemGroup.rotation, { x: rotateX, y: rotateY, z: rotateZ, duration: moveDur});
  gsap.to(this.itemGroup.scale, scale);
}

// Translate the menu's items such as their rotations & scaling based on parameters passed
Menu.prototype.itemTransition = function(parms = null) {
  const moveDur = (parms.duration && typeof parms.duration === "number") ? parms.duration : 0.5;

  const scaleTo = (parms.scale && typeof parms.scale === "number") ? parms.scale : null;
  const scaleToX = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleX : 1;
  const scaleToY = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleY : 1;
  const scaleToZ = (parms.scaleX && typeof parms.scaleX === "number") ? parms.scaleZ : 1;

  const iRotateX = (parms.rotateX && typeof parms.rotateX === "number") ? parms.rotateX : 0;
  const iRotateY = (parms.rotateY && typeof parms.rotateY === "number") ? parms.rotateY : 0;
  const iRotateZ = (parms.rotateZ && typeof parms.rotateZ === "number") ? parms.rotateZ : 0;

  const scale = {
    x: parms.scale ? scaleTo : scaleToX,
    y: parms.scale ? scaleTo : scaleToY,
    z: parms.scale ? scaleTo : scaleToZ,
    duration: moveDur
  };

  const items = this.itemGroup.children;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    gsap.to(item.rotation, {x: iRotateX, duration: moveDur });
    gsap.to(item.rotation, {y: iRotateY, duration: moveDur });
    gsap.to(item.rotation, {z: iRotateZ, duration: moveDur });
    gsap.to(item.scale, scale);
  }
}

Menu.prototype.resetMenu = function () {
  this.moveMenu({});
  this.itemTransition({});
}

// Fire a raycaster to detect which item is clicked
Menu.prototype.clickItem = function(evt) {
  if (!this.opened || clicked || !evt) return;

  pt.x = !isNaN(evt.clientX) ? (evt.clientX / window.innerWidth) * 2 - 1: 0;
  pt.y = !isNaN(evt.clientY) ? -(evt.clientY / window.innerHeight) * 2 + 1 : 0;

  // fire raycaster from camera to pt
  rayCaster.setFromCamera(pt, this.camera);
  const intersects = rayCaster.intersectObjects( this.itemGroup.children );
  
  if (intersects.length) {
    const item = intersects[0].object;
    if (nodeToSelect.id === item.itemTag) {
      this.selectItem();
    }
    else {
      if (traversalCheck(nodeToSelect, rightEdge, item.itemTag)) {
        this.moveToNext();
        if (nodeToSelect.id != item.itemTag) {
          const timer = setInterval(() => {
            this.moveToNext();
            if (nodeToSelect.id == item.itemTag) clearInterval(timer);
          }, (this.itemCount * 0.10) + (200 * this.shuffleSpeed));
        }
      }
      else if (traversalCheck(nodeToSelect, leftEdge, item.itemTag, true)) {
        this.moveToPrev();
        if (nodeToSelect.id != item.itemTag) {
          const timer = setInterval(() => {
            this.moveToPrev();
            if (nodeToSelect.id == item.itemTag) clearInterval(timer);
          }, (this.itemCount * 0.10) + (200 * this.shuffleSpeed));
        }
      }
    }
  }
}

function traversalCheck(selectedNode, endNode, targetID, isLeft = false) {

  const end = endNode;
  let current = selectedNode;
  while (current.id != end.id) {
    if (current.id == targetID) return true;
    else if (isLeft) current = current.prev;
    else current = current.next;
  }
  if (current.id == targetID) return true;
  return false;
}

/**
 * Event Listeners for menu actions
 */
Menu.prototype.registerEvents = function () {
  let clickTimer; //prevent continous click events
  
  // on keydown
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

  // mouse clicks
  window.addEventListener("pointerup", (evt) => {
    if (clickTimer) {
      clicked = false;
      clearTimeout(clickTimer);
    }
    const clickGap = 100;

    clickTimer = setTimeout(()=> {
      this.clickItem(evt)
      clicked = true;
    }, clickGap);
    
  })

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