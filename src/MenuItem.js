import * as THREE from 'three'

export function MenuItem(mesh, _properties = {}) {
  if (!mesh) return errorMsg("no mesh object provided");
  this.item = mesh;
  
  // setup items based on properties
  this.rotationSpeed = (_properties && _properties.rotationSpeed) ? _properties.rotationSpeed : 0.01;
  this.rotateX = (_properties && _properties.rotateX) ? _properties.rotateX : true;
  this.rotateY = (_properties && _properties.rotateX) ? _properties.rotateX : true;
  this.rotateZ = (_properties && _properties.rotateX) ? _properties.rotateX : true;
}

// slow rotation animation
MenuItem.prototype.animateDefault = function (elapsedTime = 0) {
  this.item.rotation.x = this.rotateX ? this.rotationSpeed * elapsedTime : this.item.rotation.x;
  this.item.rotation.y = this.rotateY ? this.rotationSpeed * elapsedTime : this.item.rotation.y;
  this.item.rotation.z = this.rotateZ ? this.rotationSpeed * elapsedTime : this.item.rotation.z;
}

// selected rotation animation
MenuItem.prototype.animateSelected = function (elapsedTime = 0) {
  this.item.rotation.x = this.rotateX ? (this.rotationSpeed * 0.25) * elapsedTime : this.item.rotation.x;
  this.item.rotation.y = this.rotateY ? (this.rotationSpeed * 0.25) * elapsedTime : this.item.rotation.y;
  this.item.rotation.z = this.rotateZ ? (this.rotationSpeed * 0.25) * elapsedTime : this.item.rotation.z;
}

function errorMsg(str) {
  return "menuItem error: " + str;
}