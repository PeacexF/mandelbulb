// Package state holds validated application state shared between the
// native Go tests and the WASM boundary.
package state

import (
	"fmt"
	"math"

	"github.com/PeacexF/mandelbulb/core/fractal"
)

const maxPitch = 89 * math.Pi / 180

type Camera struct {
	Position [3]float64
	Yaw      float64
	Pitch    float64
	FOV      float64
}

type State struct {
	Fractal fractal.Mandelbulb
	Camera  Camera
}

func Default() State {
	return State{
		Fractal: fractal.Default(),
		Camera: Camera{
			Position: [3]float64{0, 0, 3},
			Yaw:      0,
			Pitch:    0,
			FOV:      60 * math.Pi / 180,
		},
	}
}

func (s *State) SetPower(v float64) error {
	next := s.Fractal
	next.Power = v
	if err := next.Validate(); err != nil {
		return err
	}
	s.Fractal = next
	return nil
}

func (s *State) SetIterations(v int) error {
	next := s.Fractal
	next.Iterations = v
	if err := next.Validate(); err != nil {
		return err
	}
	s.Fractal = next
	return nil
}

func (s *State) SetBailout(v float64) error {
	next := s.Fractal
	next.Bailout = v
	if err := next.Validate(); err != nil {
		return err
	}
	s.Fractal = next
	return nil
}

func (s *State) SetCameraPosition(x, y, z float64) {
	s.Camera.Position = [3]float64{x, y, z}
}

func (s *State) SetCameraRotation(yaw, pitch float64) {
	s.Camera.Yaw = yaw
	s.Camera.Pitch = clamp(pitch, -maxPitch, maxPitch)
}

func (s *State) SetFOV(v float64) error {
	if v <= 0 || v >= math.Pi {
		return fmt.Errorf("state: fov must be in (0, pi) radians, got %v", v)
	}
	s.Camera.FOV = v
	return nil
}

func (s *State) Reset() {
	*s = Default()
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
