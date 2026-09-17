struct Uniforms {
  resolution_time: vec4f,
  camera_pos_power: vec4f,
  camera_right_iterations: vec4f,
  camera_up_bailout: vec4f,
  camera_forward_maxsteps: vec4f,
  epsilon_maxdistance: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
