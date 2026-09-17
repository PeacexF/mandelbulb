// Package fractal implements the Mandelbulb distance estimator
package fractal

import (
	"math"

	"github.com/go-gl/mathgl/mgl64"
)

type Mandelbulb struct {
	Power      float64
	Iterations int
	Bailout    float64
}

func Default() Mandelbulb {
	return Mandelbulb{
		Power:      8,
		Iterations: 10,
		Bailout:    2,
	}
}

// DistanceEstimate returns an estimate of the distance from p to the
// Mandelbulb surface, suitable for sphere tracing.
func (m Mandelbulb) DistanceEstimate(p mgl64.Vec3) float64 {
	z := p
	dr := 1.0
	r := 0.0

	const originEpsilon = 1e-12

	for i := 0; i < m.Iterations; i++ {
		r = z.Len()
		if r > m.Bailout {
			break
		}

		var theta, phi float64
		if r > originEpsilon {
			theta = math.Acos(clamp(z.Z()/r, -1, 1))
			phi = math.Atan2(z.Y(), z.X())
		}
		dr = math.Pow(r, m.Power-1)*m.Power*dr + 1

		zr := math.Pow(r, m.Power)
		theta *= m.Power
		phi *= m.Power

		z = mgl64.Vec3{
			math.Sin(theta) * math.Cos(phi),
			math.Sin(theta) * math.Sin(phi),
			math.Cos(theta),
		}.Mul(zr)
		z = z.Add(p)
	}

	if r < originEpsilon {
		return 0
	}
	return 0.5 * math.Log(r) * r / dr
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
