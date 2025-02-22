import * as THREE from 'three'

export function MenuItem(mesh, _properties = {}) {
  
  if (!mesh) return errorMsg("no mesh object provided");
  this.item = mesh;

  // passed functions
  this.sequenceDefault = (_properties && _properties.animateDefault) ? _properties.animateDefault : null;
  this.sequenceSelected = (_properties && _properties.animateSelect) ? _properties.selectAnimation : null;
  this.sequenceClicked = (_properties && _properties.animateClicked) ? _properties.selectClicked : null;
  
  // setup default animation on items based on properties
  this.rotationSpeed = (_properties && _properties.rotationSpeed) ? _properties.rotationSpeed : 0.01;
  this.rotateX = (_properties && _properties.rotateX) ? _properties.rotateX : false;
  this.rotateY = (_properties && _properties.rotateX) ? _properties.rotateY : true;
  this.rotateZ = (_properties && _properties.rotateX) ? _properties.rotateZ : false;
}



// slow rotation animation
MenuItem.prototype.animateDefault = function (elapsedTime = 0) {
  if (typeof this.sequenceDefault === "function") this.sequenceDefault(elapsedTime);
  else {
    this.item.rotation.x = this.rotateX ? this.rotationSpeed * elapsedTime : this.item.rotation.x;
    this.item.rotation.y = this.rotateY ? this.rotationSpeed * elapsedTime : this.item.rotation.y;
    this.item.rotation.z = this.rotateZ ? this.rotationSpeed * elapsedTime : this.item.rotation.z;
  }
}

// selected rotation animation
MenuItem.prototype.animateSelected = function (elapsedTime = 0) {
  const rotSpd = this.rotationSpeed * 0.25;
  this.item.rotation.x = this.rotateX ? rotSpd * elapsedTime : this.item.rotation.x;
  this.item.rotation.y = this.rotateY ? rotSpd * elapsedTime : this.item.rotation.y;
  this.item.rotation.z = this.rotateZ ? rotSpd * elapsedTime : this.item.rotation.z;
}

function errorMsg(str) {
  return "menuItem error: " + str;
}