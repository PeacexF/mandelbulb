//go:build js && wasm

package main

import (
	"syscall/js"

	"github.com/PeacexF/mandelbulb/core/state"
)

var appState = state.Default()

func errString(err error) any {
	if err != nil {
		return err.Error()
	}
	return nil
}

func setPower(_ js.Value, args []js.Value) any {
	return errString(appState.SetPower(args[0].Float()))
}

func setIterations(_ js.Value, args []js.Value) any {
	return errString(appState.SetIterations(int(args[0].Float())))
}

func setBailout(_ js.Value, args []js.Value) any {
	return errString(appState.SetBailout(args[0].Float()))
}

func setCameraPosition(_ js.Value, args []js.Value) any {
	appState.SetCameraPosition(args[0].Float(), args[1].Float(), args[2].Float())
	return nil
}

func setCameraRotation(_ js.Value, args []js.Value) any {
	appState.SetCameraRotation(args[0].Float(), args[1].Float())
	return nil
}

func setFOV(_ js.Value, args []js.Value) any {
	return errString(appState.SetFOV(args[0].Float()))
}

func reset(_ js.Value, _ []js.Value) any {
	appState.Reset()
	return nil
}

func getState(_ js.Value, _ []js.Value) any {
	return js.ValueOf(map[string]any{
		"power":       appState.Fractal.Power,
		"iterations":  appState.Fractal.Iterations,
		"bailout":     appState.Fractal.Bailout,
		"cameraX":     appState.Camera.Position[0],
		"cameraY":     appState.Camera.Position[1],
		"cameraZ":     appState.Camera.Position[2],
		"cameraYaw":   appState.Camera.Yaw,
		"cameraPitch": appState.Camera.Pitch,
		"fov":         appState.Camera.FOV,
	})
}

func main() {
	api := js.Global().Get("Object").New()
	api.Set("setPower", js.FuncOf(setPower))
	api.Set("setIterations", js.FuncOf(setIterations))
	api.Set("setBailout", js.FuncOf(setBailout))
	api.Set("setCameraPosition", js.FuncOf(setCameraPosition))
	api.Set("setCameraRotation", js.FuncOf(setCameraRotation))
	api.Set("setFOV", js.FuncOf(setFOV))
	api.Set("reset", js.FuncOf(reset))
	api.Set("getState", js.FuncOf(getState))
	js.Global().Set("mandelbulbCore", api)

	js.Global().Call("__mandelbulbReady")

	select {}
}
