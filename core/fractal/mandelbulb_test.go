package fractal

import (
	"math"
	"testing"

	"github.com/go-gl/mathgl/mgl64"
)

func TestDistanceEstimateOrigin(t *testing.T) {
	m := Default()
	d := m.DistanceEstimate(mgl64.Vec3{0, 0, 0})
	if math.IsNaN(d) {
		t.Fatalf("origin: expected finite value, got NaN")
	}
}

func TestDistanceEstimateFarOutside(t *testing.T) {
	m := Default()
	p := mgl64.Vec3{100, 0, 0}
	d := m.DistanceEstimate(p)
	if math.IsNaN(d) || math.IsInf(d, 0) {
		t.Fatalf("far outside: expected finite value, got %v", d)
	}
	if d <= 90 {
		t.Fatalf("far outside: expected distance close to %v, got %v", p.Len(), d)
	}
}

func TestDefault(t *testing.T) {
	m := Default()
	if m.Power != 8 {
		t.Errorf("expected default power 8, got %v", m.Power)
	}
	if m.Bailout != 2 {
		t.Errorf("expected default bailout 2, got %v", m.Bailout)
	}
	if err := m.Validate(); err != nil {
		t.Errorf("expected default parameters to be valid, got %v", err)
	}
}

func TestDistanceEstimateFinite(t *testing.T) {
	m := Default()
	points := []mgl64.Vec3{
		{0, 0, 0},
		{1e-13, 0, 0},
		{0, 1e-13, 0},
		{0, 0, 1e-13},
		{0.1, 0, 0},
		{0, 0.1, 0},
		{0, 0, 0.1},
		{-1, -1, -1},
		{1, 1, 1},
		{0.5, -0.5, 0.5},
		{2, 0, 0},
		{0, 2, 0},
		{0, 0, 2},
		{5, 5, 5},
		{-100, 3, -7},
	}

	for _, p := range points {
		d := m.DistanceEstimate(p)
		if math.IsNaN(d) || math.IsInf(d, 0) {
			t.Errorf("point %v: expected finite value, got %v", p, d)
		}
	}
}

func TestDistanceEstimateFarOutsideVariousDirections(t *testing.T) {
	m := Default()
	dirs := []mgl64.Vec3{
		{1, 0, 0}, {0, 1, 0}, {0, 0, 1},
		{-1, 0, 0}, {0, -1, 0}, {0, 0, -1},
		{1, 1, 1},
	}

	for _, dir := range dirs {
		p := dir.Normalize().Mul(50)
		d := m.DistanceEstimate(p)
		if math.IsNaN(d) || math.IsInf(d, 0) {
			t.Errorf("direction %v: expected finite value, got %v", dir, d)
		}
		if d <= 0 {
			t.Errorf("direction %v: expected positive distance far outside the set, got %v", dir, d)
		}
	}
}

// TestDistanceEstimateHighPowerBailoutStaysFinite guards against dr's
// per-iteration growth (roughly power*bailout^(power-1)) escaping a sane
// range for aggressive parameter combinations. Go's float64 has enough
// headroom that this doesn't overflow here, but the WGSL shader mirrors
// this exact formula in f32, where the same combinations overflowed to
// Inf/NaN within a handful of iterations — poisoning the ray marcher's hit
// test (NaN compares false against everything, so a ray can never resolve
// a hit or a miss). Both implementations clamp dr; this test documents why.
func TestDistanceEstimateHighPowerBailoutStaysFinite(t *testing.T) {
	points := []mgl64.Vec3{
		{0, 0, 0}, {1, 1, 1}, {3, 0, 0}, {4.9, 0, 0}, {0, 4.9, 0}, {2, 2, 2},
	}

	for _, power := range []float64{3, 8, 12, 16} {
		for _, bailout := range []float64{2, 3, 5} {
			m := Mandelbulb{Power: power, Iterations: 16, Bailout: bailout}
			for _, p := range points {
				d := m.DistanceEstimate(p)
				if math.IsNaN(d) || math.IsInf(d, 0) {
					t.Errorf("power=%v bailout=%v point=%v: expected finite value, got %v", power, bailout, p, d)
				}
			}
		}
	}
}

func TestDistanceEstimateMonotonicWithDistance(t *testing.T) {
	m := Default()
	near := m.DistanceEstimate(mgl64.Vec3{3, 0, 0})
	far := m.DistanceEstimate(mgl64.Vec3{10, 0, 0})
	if !(far > near) {
		t.Fatalf("expected DE to grow with distance from the fractal: near=%v far=%v", near, far)
	}
}

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		m       Mandelbulb
		wantErr bool
	}{
		{"default", Default(), false},
		{"zero power", Mandelbulb{Power: 0, Iterations: 8, Bailout: 2}, true},
		{"negative power", Mandelbulb{Power: -1, Iterations: 8, Bailout: 2}, true},
		{"zero iterations", Mandelbulb{Power: 8, Iterations: 0, Bailout: 2}, true},
		{"negative iterations", Mandelbulb{Power: 8, Iterations: -1, Bailout: 2}, true},
		{"zero bailout", Mandelbulb{Power: 8, Iterations: 8, Bailout: 0}, true},
		{"negative bailout", Mandelbulb{Power: 8, Iterations: 8, Bailout: -2}, true},
		{"power one", Mandelbulb{Power: 1, Iterations: 8, Bailout: 2}, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.m.Validate()
			if c.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !c.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}
