package state

import (
	"math"
	"testing"
)

func TestDefault(t *testing.T) {
	s := Default()
	if err := s.Fractal.Validate(); err != nil {
		t.Errorf("expected default fractal params to be valid, got %v", err)
	}
	if s.Camera.FOV <= 0 || s.Camera.FOV >= math.Pi {
		t.Errorf("expected default fov in (0, pi), got %v", s.Camera.FOV)
	}
}

func TestSetPower(t *testing.T) {
	s := Default()
	if err := s.SetPower(6); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if s.Fractal.Power != 6 {
		t.Errorf("expected power 6, got %v", s.Fractal.Power)
	}

	before := s.Fractal
	if err := s.SetPower(0); err == nil {
		t.Fatalf("expected error for power 0")
	}
	if s.Fractal != before {
		t.Errorf("expected fractal params unchanged after rejected update")
	}
}

func TestSetIterations(t *testing.T) {
	s := Default()
	if err := s.SetIterations(20); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if s.Fractal.Iterations != 20 {
		t.Errorf("expected iterations 20, got %v", s.Fractal.Iterations)
	}

	if err := s.SetIterations(0); err == nil {
		t.Fatalf("expected error for iterations 0")
	}
}

func TestSetBailout(t *testing.T) {
	s := Default()
	if err := s.SetBailout(4); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if s.Fractal.Bailout != 4 {
		t.Errorf("expected bailout 4, got %v", s.Fractal.Bailout)
	}

	if err := s.SetBailout(-1); err == nil {
		t.Fatalf("expected error for negative bailout")
	}
}

func TestSetCameraPosition(t *testing.T) {
	s := Default()
	s.SetCameraPosition(1, 2, 3)
	want := [3]float64{1, 2, 3}
	if s.Camera.Position != want {
		t.Errorf("expected position %v, got %v", want, s.Camera.Position)
	}
}

func TestSetCameraRotationClampsPitch(t *testing.T) {
	s := Default()

	s.SetCameraRotation(1.5, 0.5)
	if s.Camera.Yaw != 1.5 {
		t.Errorf("expected yaw 1.5, got %v", s.Camera.Yaw)
	}
	if s.Camera.Pitch != 0.5 {
		t.Errorf("expected pitch 0.5, got %v", s.Camera.Pitch)
	}

	s.SetCameraRotation(0, math.Pi)
	if s.Camera.Pitch != maxPitch {
		t.Errorf("expected pitch clamped to %v, got %v", maxPitch, s.Camera.Pitch)
	}

	s.SetCameraRotation(0, -math.Pi)
	if s.Camera.Pitch != -maxPitch {
		t.Errorf("expected pitch clamped to %v, got %v", -maxPitch, s.Camera.Pitch)
	}
}

func TestSetFOV(t *testing.T) {
	s := Default()
	if err := s.SetFOV(1.0); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if s.Camera.FOV != 1.0 {
		t.Errorf("expected fov 1.0, got %v", s.Camera.FOV)
	}

	if err := s.SetFOV(0); err == nil {
		t.Fatalf("expected error for fov 0")
	}
	if err := s.SetFOV(math.Pi); err == nil {
		t.Fatalf("expected error for fov >= pi")
	}
}

func TestReset(t *testing.T) {
	s := Default()
	if err := s.SetPower(3); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	s.SetCameraPosition(9, 9, 9)
	s.SetCameraRotation(1, 1)

	s.Reset()

	if s != Default() {
		t.Errorf("expected state to equal defaults after reset, got %+v", s)
	}
}
