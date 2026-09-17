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
		{"zero iterations", Mandelbulb{Power: 8, Iterations: 0, Bailout: 2}, true},
		{"zero bailout", Mandelbulb{Power: 8, Iterations: 8, Bailout: 0}, true},
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
