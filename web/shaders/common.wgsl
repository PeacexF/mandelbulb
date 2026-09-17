struct Uniforms {
  resolution_time: vec4f,
  camera_pos_power: vec4f,
  camera_right_iterations: vec4f,
  camera_up_bailout: vec4f,
  camera_forward_maxsteps: vec4f,
  epsilon_maxdistance: vec4f,
  light_dir_ambient: vec4f,
  light_color_specular: vec4f,
  shading_extra: vec4f,
  display_params: vec4f,
  fog_color: vec4f,
  camera_pos_lo: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
